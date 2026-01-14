import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Gift, Music, Edit, Play, Pause, CheckCircle2, X } from '@/utils/iconImports';
import { Badge } from '@/components/ui/badge';

// ✅ OTIMIZAÇÃO: Usar URLs estáticas em vez de imports (evita incluir no bundle)
const laNaEscolaAudio = '/audio/la_na_escola-2.mp3';
const popFelizAudio = '/audio/pop_feliz.mp3';
import { toast } from 'sonner';
import { ZodError } from 'zod';
import { createCheckoutLogger } from '@/lib/checkout-logger';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import { useUtmifyTracking } from '@/hooks/useUtmifyTracking';
import { emailSchema, formatWhatsappForCakto, whatsappSchema } from '@/pages/Checkout/utils/checkoutValidation';
import { validateQuiz, sanitizeQuiz, formatValidationErrors, type QuizData as ValidationQuizData } from '@/utils/quizValidation';
import { checkDataDivergence, markQuizAsSynced, getOrCreateQuizSessionId, clearQuizSessionId } from '@/utils/quizSync';
import { logger } from '@/utils/logger';
import { sanitizeEmail } from '@/utils/sanitize';
import { insertQuizWithRetry, type QuizPayload } from '@/utils/quizInsert';
import { enqueueQuizToServer } from '@/utils/quizInsert';
import CheckoutHeader from './components/CheckoutHeader';
import CheckoutForm from './components/CheckoutForm';
import CheckoutSummary from './components/CheckoutSummary';
import CheckoutPaymentButton from './components/CheckoutPaymentButton';
import CheckoutPlanSelection from './components/CheckoutPlanSelection';
import CheckoutSidebar from './components/CheckoutSidebar';
import { useCheckoutForm } from './hooks/useCheckoutForm';
import { useCheckoutAudio } from './hooks/useCheckoutAudio';

// Interface para resposta da edge function stripe-checkout
interface StripeCheckoutResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
  message?: string;
  plan?: string;
  priceId?: string;
}

interface QuizData {
  id?: string; // ✅ ID do quiz quando vem do banco
  about_who: string;
  relationship?: string;
  style: string;
  language: string;
  vocal_gender?: string | null; // ✅ Preferência de gênero vocal: 'm', 'f', ou null/undefined
  qualities?: string;
  memories?: string;
  message?: string;
  occasion?: string;
  desired_tone?: string;
  key_moments?: string | null;
  answers?: Record<string, unknown>;
  timestamp?: string;
  whatsapp?: string; // ✅ Número de WhatsApp
  session_id?: string; // ✅ UUID único da sessão do navegador
}

interface CheckoutDraft {
  email: string;
  whatsapp: string;
  planId: string;
  quizData: QuizData;
  transactionId: string;
  timestamp: number;
}

type PlanId = 'standard' | 'express';

type Plan = {
  id: PlanId;
  name: string;
  price: number;
  currency: 'BRL';
  delivery: string;
  featured: boolean;
  badge?: string;
  features: string[];
};

// ✅ Configuração de preço fixo: R$ 47,90 (apenas Brasil, BRL)
const getCaktoConfig = () => {
  return {
    url: 'https://pay.cakto.com.br/d877u4t_665160',
    amount_cents: 4790,
    price_display: 4790
  };
};

// ✅ Função para selecionar gateway de pagamento
// SEMPRE retorna 'hotmart' como método de pagamento padrão
const getPaymentGateway = () => {
  // Verificar variável de ambiente primeiro (permite override se necessário)
  const envGateway = import.meta.env.VITE_PAYMENT_GATEWAY;
  if (envGateway === 'hotmart' || envGateway === 'cakto') {
    return envGateway;
  }
  
  // Sempre usar Hotmart como padrão
  return 'hotmart';
};

// ✅ Configuração da Hotmart
const getHotmartConfig = () => {
  // URL completa já inclui o product_id: https://pay.hotmart.com/O103476976K
  const checkoutUrl = import.meta.env.VITE_HOTMART_CHECKOUT_URL || 'https://pay.hotmart.com/O103476976K';
  const productId = import.meta.env.VITE_HOTMART_PRODUCT_ID || '6840691';
  return {
    url: checkoutUrl,
    product_id: productId,
    amount_cents: 4790,
    price_display: 4790
  };
};

// ✅ OTIMIZAÇÃO: Preload de recursos críticos antes do componente renderizar
if (typeof window !== 'undefined') {
  // Preload de componentes UI críticos para botões aparecerem imediatamente
  Promise.all([
    import('@/components/ui/button').catch(() => {}),
    import('@/components/ui/card').catch(() => {}),
    import('@/components/ui/input').catch(() => {}),
    import('@/components/ui/badge').catch(() => {}),
    import('lucide-react').catch(() => {}),
  ]).catch(() => {});
}

export default function Checkout() {
  logger.debug('Checkout component mounted');
  
  // ✅ OTIMIZAÇÃO: Preconnect dinâmico ao gateway de pagamento no mount (sempre Hotmart)
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://pay.hotmart.com';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }, []);
  
  // ⚠️ CRÍTICO: Verificação IMEDIATA antes de qualquer processamento
  // Se a URL contém message_id (veio do WhatsApp), redirecionar IMEDIATAMENTE para Hotmart
  // Isso deve acontecer ANTES de qualquer lógica do componente
  const urlParams = new URLSearchParams(window.location.search);
  const messageId = urlParams.get('message_id');
  const orderId = urlParams.get('order_id');
  
  // ⚠️ REDIRECIONAMENTO IMEDIATO: Se tem message_id, redirecionar ANTES de processar qualquer coisa
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  useEffect(() => {
    if (messageId && orderId && !window.location.href.includes('pay.hotmart.com') && !isRedirecting) {
      logger.debug('REDIRECIONAMENTO IMEDIATO: URL do WhatsApp detectada (tem message_id), redirecionando para Hotmart ANTES de processar...');
      setIsRedirecting(true);
      
      // Buscar pedido e redirecionar IMEDIATAMENTE
      supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
        .then(({ data: orderData, error }) => {
          if (!error && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            const hotmartConfig = getHotmartConfig();
            const HOTMART_CHECKOUT_URL = hotmartConfig.url;
            
            // Normalizar WhatsApp e garantir prefixo 55
            let normalizedWhatsapp = orderData.customer_whatsapp.replace(/\D/g, '');
            if (!normalizedWhatsapp.startsWith('55')) {
              normalizedWhatsapp = `55${normalizedWhatsapp}`;
            }
            
            // Gerar URL da Hotmart
            const hotmartUrl = generateHotmartUrl(
              orderData.id,
              orderData.customer_email,
              orderData.customer_whatsapp,
              'pt',
              {}
            );
            
            logger.debug('Redirecionando IMEDIATAMENTE para Hotmart', { hotmartUrl: hotmartUrl.substring(0, 100) });
            // ⚠️ CRÍTICO: Usar window.location.replace para evitar que o React Router intercepte
            window.location.replace(hotmartUrl);
          } else {
            setIsRedirecting(false);
          }
        })
        .catch((err) => {
          logger.error('Erro ao buscar pedido para redirecionamento', err);
          setIsRedirecting(false);
        });
    }
  }, [messageId, orderId, isRedirecting]);
  
  const navigate = useNavigate();
  const { t, currentLanguage: contextLanguage } = useTranslation();
  // Preservar UTMs através do funil
  const { navigateWithUtms, getUtmQueryString, utms } = useUtmParams();
  // Hook para tracking de eventos
  const { trackEvent } = useUtmifyTracking();
  
  // ✅ Flag para evitar múltiplos toasts de erro
  const toastShownRef = useRef(false);
  // ✅ Flag para evitar múltiplas execuções do useEffect principal
  const hasProcessedRef = useRef(false);
  // ✅ Flag para evitar redirecionamentos múltiplos
  const isRedirectingRef = useRef(false);
  
  const [quiz, setQuiz] = useState<QuizData | null>(null);

  // Sempre português - idiomas removidos
  const getCurrentLanguage = () => {
    return 'pt'; // Sempre português
  };
  
  // ✅ Função helper para obter caminho do quiz com prefixo de idioma
  const getQuizPath = () => {
    // ✅ CORREÇÃO: Remover prefixo de idioma
    return `/quiz`;
  };
  
  const currentLanguage = getCurrentLanguage();
  
  // ✅ CORREÇÃO: Garantir que o locale seja atualizado quando o contexto mudar
  // Isso garante que as traduções sejam atualizadas quando a URL mudar
  useEffect(() => {
    const detected = getCurrentLanguage();
    if (detected !== currentLanguage && contextLanguage) {
      // O locale do contexto mudou, forçar re-render se necessário
      logger.debug('Locale atualizado no Checkout', { 
        detected, 
        currentLanguage, 
        contextLanguage,
        pathname: window.location.pathname 
      });
    }
  }, [contextLanguage, currentLanguage]);

  // Sem persistência do idioma: seguimos apenas a URL
  
  // Função auxiliar para gerar URL da Cakto
  const generateCaktoUrl = (
    orderId: string,
    email: string,
    whatsapp: string,
    language: string,
    utms: Record<string, string | null>
  ): string => {
    const caktoConfig = getCaktoConfig();
    const CAKTO_PAYMENT_URL = caktoConfig.url;
    const origin = window.location.origin;
    const utmQuery = getUtmQueryString(false);
    // ✅ CORREÇÃO: Padronizar redirect_url para /payment-success (sem barra antes de success)
    // ✅ CORREÇÃO: Remover prefixo de idioma
    const redirectUrl = `${origin}/payment-success?order_id=${orderId}${utmQuery}`;
    
    // Normalizar WhatsApp para formato correto (55XXXXXXXXXXX)
    const normalizedWhatsapp = formatWhatsappForCakto(whatsapp);
    
    const caktoParams = new URLSearchParams();
    caktoParams.set('order_id', orderId);
    caktoParams.set('email', email);
    // ✅ Cakto usa 'phone' para pré-preencher o telefone (não 'whatsapp')
    // Formato: código do país + DDD + número (ex: 5511999999999)
    // ✅ CORREÇÃO: Só adicionar phone se WhatsApp for válido
    if (normalizedWhatsapp && normalizedWhatsapp.trim() !== '') {
      caktoParams.set('phone', normalizedWhatsapp);
    } else {
      logger.warn('⚠️ [generateCaktoUrl] WhatsApp inválido ou vazio, URL será gerada sem phone', {
        orderId,
        email,
        whatsapp
      });
    }
    caktoParams.set('language', language);
    caktoParams.set('redirect_url', redirectUrl);
    
    // Adicionar parâmetros UTM para rastreamento na Cakto
    const safeUtms = utms || {};
    Object.entries(safeUtms).forEach(([key, value]) => {
      if (value && ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck'].includes(key)) {
        caktoParams.set(key, value as string);
      }
    });

    return `${CAKTO_PAYMENT_URL}?${caktoParams.toString()}`;
  };

  // Função auxiliar para redirecionar para Cakto
  // Retorna true se sucesso, false se falhou
  const redirectToCakto = async (
    orderData: any,
    utmsParam?: Record<string, string | null>,
    language: string = 'pt'
  ): Promise<boolean> => {
    try {
      logger.debug('redirectToCakto chamado', {
        orderId: orderData.id,
        status: orderData.status,
        hasEmail: !!orderData.customer_email,
        hasWhatsapp: !!orderData.customer_whatsapp,
        currentPath: window.location.pathname
      });

      // Verificar se pedido tem dados necessários
      if (!orderData.customer_email || !orderData.customer_whatsapp) {
        logger.error('redirectToCakto: Pedido sem email ou WhatsApp');
        return false;
      }

      // Verificar se já existe URL da Cakto salva
      let caktoUrl = orderData.cakto_payment_url;
      
      if (!caktoUrl || caktoUrl.trim() === '') {
        // Gerar nova URL da Cakto
        logger.debug('redirectToCakto: Gerando nova URL da Cakto...');
        const safeUtms = utmsParam || utms || {};
        caktoUrl = generateCaktoUrl(
          orderData.id,
          orderData.customer_email,
          orderData.customer_whatsapp,
          language,
          safeUtms
        );
        
        // Salvar URL no pedido
        logger.debug('redirectToCakto: Salvando URL da Cakto no pedido...');
        const { error: updateError } = await supabase
          .from('orders')
          .update({ cakto_payment_url: caktoUrl })
          .eq('id', orderData.id);
        
        if (updateError) {
          logger.error('redirectToCakto: Erro ao salvar URL da Cakto', updateError);
          // Continuar mesmo assim, a URL foi gerada
        } else {
          logger.debug('redirectToCakto: URL da Cakto salva com sucesso');
        }
      } else {
        logger.debug('redirectToCakto: Usando URL da Cakto salva');
      }
      
      // ✅ CORREÇÃO: Validar URL antes de redirecionar
      if (!caktoUrl || !caktoUrl.startsWith('http')) {
        logger.error('redirectToCakto: URL inválida', { caktoUrl });
        return false;
      }

      // ✅ CORREÇÃO: Verificar se não estamos já na Cakto
      if (window.location.hostname === 'pay.cakto.com.br') {
        logger.debug('redirectToCakto: Já estamos na Cakto, não redirecionar novamente');
        return true;
      }

      logger.debug('redirectToCakto: Redirecionando para Cakto', {
        orderId: orderData.id,
        email: orderData.customer_email,
        whatsapp: orderData.customer_whatsapp,
        urlLength: caktoUrl.length,
        urlPreview: caktoUrl.substring(0, 100) + '...',
        hostname: window.location.hostname
      });

      // ✅ CORREÇÃO: Redirecionamento imediato sem setTimeout
      // Usar window.location.replace() para evitar que React Router intercepte
      logger.debug('redirectToCakto: Executando redirecionamento imediato com window.location.replace()');
      try {
        window.location.replace(caktoUrl);
        logger.debug('redirectToCakto: window.location.replace() executado com sucesso');
      } catch (error) {
        logger.error('redirectToCakto: Erro ao executar window.location.replace()', error);
        // Fallback: tentar com href
        try {
          window.location.href = caktoUrl;
          logger.debug('redirectToCakto: Fallback para window.location.href executado');
        } catch (hrefError) {
          logger.error('redirectToCakto: Erro também no fallback href', hrefError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('redirectToCakto: Erro ao redirecionar', error);
      return false;
    }
  };

  // Função auxiliar para gerar URL da Hotmart
  const generateHotmartUrl = (
    orderId: string,
    email: string,
    whatsapp: string,
    language: string,
    utms: Record<string, string | null>
  ): string => {
    const hotmartConfig = getHotmartConfig();
    const HOTMART_CHECKOUT_URL = hotmartConfig.url;
    
    // Normalizar WhatsApp para formato correto (55XXXXXXXXXXX)
    const normalizedWhatsapp = formatWhatsappForCakto(whatsapp);
    
    // Criar URL base (já inclui product_id)
    const url = new URL(HOTMART_CHECKOUT_URL);
    
    // Adicionar parâmetros de checkout
    url.searchParams.set('checkoutMode', '2'); // Modo checkout direto
    url.searchParams.set('email', email);
    
    // Adicionar telefone se válido
    if (normalizedWhatsapp && normalizedWhatsapp.trim() !== '') {
      url.searchParams.set('phone', normalizedWhatsapp);
    }
    
    // Adicionar nome se disponível (opcional)
    // A Hotmart pode usar o nome do pedido se disponível
    
    // Adicionar parâmetros UTM para rastreamento
    const safeUtms = utms || {};
    Object.entries(safeUtms).forEach(([key, value]) => {
      if (value && ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck'].includes(key)) {
        url.searchParams.set(key, value as string);
      }
    });
    
    // Adicionar order_id como parâmetro customizado para rastreamento
    url.searchParams.set('order_id', orderId);
    
    return url.toString();
  };

  // Função auxiliar para redirecionar para Hotmart
  // Retorna true se sucesso, false se falhou
  const redirectToHotmart = async (
    orderData: any,
    utmsParam?: Record<string, string | null>,
    language: string = 'pt'
  ): Promise<boolean> => {
    try {
      logger.debug('redirectToHotmart chamado', {
        orderId: orderData.id,
        status: orderData.status,
        hasEmail: !!orderData.customer_email,
        hasWhatsapp: !!orderData.customer_whatsapp,
        currentPath: window.location.pathname
      });

      // Verificar se pedido tem dados necessários
      if (!orderData.customer_email || !orderData.customer_whatsapp) {
        logger.error('redirectToHotmart: Pedido sem email ou WhatsApp');
        return false;
      }

      // Verificar se já existe URL da Hotmart salva
      let hotmartUrl = orderData.hotmart_payment_url;
      
      if (!hotmartUrl || hotmartUrl.trim() === '') {
        // Gerar nova URL da Hotmart
        logger.debug('redirectToHotmart: Gerando nova URL da Hotmart...');
        const safeUtms = utmsParam || utms || {};
        hotmartUrl = generateHotmartUrl(
          orderData.id,
          orderData.customer_email,
          orderData.customer_whatsapp,
          language,
          safeUtms
        );
        
        // Salvar URL no pedido
        logger.debug('redirectToHotmart: Salvando URL da Hotmart no pedido...');
        const { error: updateError } = await supabase
          .from('orders')
          .update({ hotmart_payment_url: hotmartUrl })
          .eq('id', orderData.id);
        
        if (updateError) {
          logger.error('redirectToHotmart: Erro ao salvar URL da Hotmart', updateError);
          // Continuar mesmo assim, a URL foi gerada
        } else {
          logger.debug('redirectToHotmart: URL da Hotmart salva com sucesso');
        }
      } else {
        logger.debug('redirectToHotmart: Usando URL da Hotmart salva');
      }
      
      // Validar URL antes de redirecionar
      if (!hotmartUrl || !hotmartUrl.startsWith('http')) {
        logger.error('redirectToHotmart: URL inválida', { hotmartUrl });
        return false;
      }

      // Verificar se não estamos já na Hotmart
      if (window.location.hostname === 'pay.hotmart.com') {
        logger.debug('redirectToHotmart: Já estamos na Hotmart, não redirecionar novamente');
        return true;
      }

      logger.debug('redirectToHotmart: Redirecionando para Hotmart', {
        orderId: orderData.id,
        email: orderData.customer_email,
        whatsapp: orderData.customer_whatsapp,
        urlLength: hotmartUrl.length,
        urlPreview: hotmartUrl.substring(0, 100) + '...',
        hostname: window.location.hostname
      });

      // Redirecionamento imediato sem setTimeout
      // Usar window.location.replace() para evitar que React Router intercepte
      logger.debug('redirectToHotmart: Executando redirecionamento imediato com window.location.replace()');
      try {
        window.location.replace(hotmartUrl);
        logger.debug('redirectToHotmart: window.location.replace() executado com sucesso');
      } catch (error) {
        logger.error('redirectToHotmart: Erro ao executar window.location.replace()', error);
        // Fallback: tentar com href
        try {
          window.location.href = hotmartUrl;
          logger.debug('redirectToHotmart: Fallback para window.location.href executado');
        } catch (hrefError) {
          logger.error('redirectToHotmart: Erro também no fallback href', hrefError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('redirectToHotmart: Erro ao redirecionar', error);
      return false;
    }
  };
  
  logger.debug('Idioma detectado', {
    pathname: window.location.pathname,
    currentLanguage,
    docLang: document.documentElement.lang,
    storedLang: localStorage.getItem('musiclovely_language'),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer
  });

  // Planos fixos: apenas Brasil, BRL, R$ 47,90
  const getPlansForLanguage = (): Plan[] => {
    const caktoConfig = getCaktoConfig();
    
    // Sempre retorna apenas 1 plano BRL
    return [
      {
        id: 'express',
        name: t('checkout.expressPlan'),
        price: caktoConfig.price_display,
        currency: 'BRL',
        delivery: t('checkout.delivery24h'),
        featured: true,
        features: [
          t('checkout.features.highQualityMP3'),
          t('checkout.features.customCover'),
          t('checkout.features.fullLyrics'),
          t('checkout.features.unlimitedDownload'),
          t('checkout.features.professionalProduction'),
          t('checkout.features.delivery24h')
        ]
      }
    ];
  };

  const plans = getPlansForLanguage();
  
  // ✅ REFATORAÇÃO: Usar hooks customizados
  const {
    email,
    whatsapp,
    emailError,
    whatsappError,
    buttonError,
    setEmail,
    setWhatsapp,
    setButtonError,
    validateEmail,
    validateWhatsApp,
    formatWhatsApp,
    normalizedEmailRef,
    normalizedWhatsAppRef
  } = useCheckoutForm();
  
  const {
    currentlyPlaying,
    currentTimes,
    durations,
    togglePlay,
    formatTime,
    audioElementsRef
  } = useCheckoutAudio();
  
  // ✅ OTIMIZAÇÃO: URL preparada antecipadamente quando email/whatsapp são válidos
  const preparedUrlRef = useRef<string | null>(null);
  const [cameFromRestore, setCameFromRestore] = useState(false); // ✅ Flag para detectar se veio do restore
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(() => {
    // Selecionar plano padrão baseado no idioma
    if (currentLanguage === 'pt') {
      return 'express'; // Único plano disponível
    } else {
      return 'express'; // Plano mais popular (48h)
    }
  });
  const [loading, setLoading] = useState(true);
  logger.debug('Estado inicial', { loading, quiz: null });
  const [processing, setProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldRedirect, setShouldRedirect] = useState(false); // ✅ Adicionar estado que estava faltando
  const [lastClickTime, setLastClickTime] = useState(0);

  // ⚠️ NOTA: Scripts UTMify são carregados globalmente no index.html
  // Não é necessário carregar novamente aqui para evitar duplicação
  // Os scripts já estão configurados no <head> do index.html

  // ✅ OTIMIZAÇÃO CRÍTICA: Deferir loading inicial para não bloquear renderização
  // Mostrar botão imediatamente, carregar dados depois
  useEffect(() => {
    // ✅ IMEDIATO: Parar loading para mostrar botão
    setLoading(false);
  }, []);

  // FASE 2 & 3: Carregar quiz do banco (se vier da URL) ou do localStorage
  // ✅ OTIMIZAÇÃO: Deferir para não bloquear renderização inicial
  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Executar após primeiro paint usando requestIdleCallback
    const executeAfterPaint = () => {
      logger.debug('Checkout useEffect iniciado - Componente montado');
      
      // ⚠️ CRÍTICO: Se a URL atual é da Cakto, não processar nada - deixar o navegador seguir naturalmente
      // Isso evita que o React Router intercepte URLs externas da Cakto
      if (window.location.hostname === 'pay.cakto.com.br') {
        logger.debug('URL da Cakto detectada no useEffect principal - não processando lógica de checkout interno', {
          hostname: window.location.hostname,
          url: window.location.href
        });
        setLoading(false);
        return; // Deixar o navegador seguir naturalmente para a Cakto sem interceptação
      }
      
      // ✅ Resetar flag ao montar (permite re-execução se componente remontar)
      hasProcessedRef.current = false;
      
      // ✅ Evitar múltiplas execuções DURANTE a mesma montagem
      if (hasProcessedRef.current) {
        logger.warn('useEffect já foi executado nesta montagem, ignorando...');
        return;
      }
      
      hasProcessedRef.current = true;
      
      // ✅ Resetar flag de toast ao montar componente
      toastShownRef.current = false;
      
      // ✅ VERIFICAÇÃO IMEDIATA antes de processar
      const immediateCheck = localStorage.getItem('pending_quiz');
      const immediateSessionCheck = sessionStorage.getItem('pending_quiz');
      logger.debug('Verificação imediata', {
        hasPendingQuiz: !!immediateCheck,
        hasSessionQuiz: !!immediateSessionCheck,
        pendingQuizLength: immediateCheck?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Usar requestAnimationFrame para evitar problemas de CSP
      const processLocalStorage = async () => {
      logger.debug('Processando localStorage e URL...');
      
      // ⚠️ VERIFICAÇÃO ADICIONAL: Se a URL atual é da Cakto, não processar nada
      if (window.location.hostname === 'pay.cakto.com.br') {
        logger.debug('URL da Cakto detectada em processLocalStorage - não processando');
        setLoading(false);
        return;
      }
      
      // ✅ PRIORIDADE 0: Verificar parâmetros da URL primeiro (mas só processar se houver restore)
      const urlParams = new URLSearchParams(window.location.search);
      const restore = urlParams.get('restore');
      const orderId = urlParams.get('order_id');
      const quizId = urlParams.get('quiz_id');
      const token = urlParams.get('token');
      const messageId = urlParams.get('message_id');
      const auto = urlParams.get('auto');
      
      // ⚠️ CRÍTICO: Se a URL contém message_id (veio do WhatsApp), redirecionar IMEDIATAMENTE para Hotmart
      // Isso evita que o React Router processe como checkout interno
      if (messageId && orderId && !window.location.href.includes('pay.cakto.com.br')) {
        logger.debug('URL do WhatsApp detectada (tem message_id), redirecionando IMEDIATAMENTE para Cakto...');
        setLoading(true);
        
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          
          if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            logger.debug('Pedido encontrado, redirecionando para Hotmart...');
            const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
            if (redirectSuccess) {
              return; // Redirecionamento bem-sucedido, sair da função
            }
          }
        } catch (redirectError) {
          logger.error('Erro ao redirecionar para Hotmart', redirectError);
          // Continuar com fluxo normal se redirecionamento falhar
        }
      }
      
      // Registrar clique na mensagem se message_id estiver presente
      if (messageId && orderId) {
        logger.event('whatsapp_message_clicked', { messageId, orderId });
      }
      
      logger.debug('Verificando parâmetros de restore', { auto, restore, orderId, quizId, hasRestore: restore === 'true' });
      
      // ✅ Declarar variáveis do localStorage no início da função (escopo da função)
      let pendingQuiz = localStorage.getItem('pending_quiz');
      const draftKey = 'checkout_draft';
      let savedDraft = localStorage.getItem(draftKey);
      
      // ✅ Se há quiz no localStorage E NÃO há restore=true, processar localStorage primeiro
      if (pendingQuiz && restore !== 'true') {
        logger.debug('Quiz encontrado no localStorage e não há restore, processando localStorage primeiro');
        try {
          const quizData = JSON.parse(pendingQuiz);
          logger.debug('Quiz data parseado com sucesso', {
            hasAboutWho: !!quizData.about_who,
            hasStyle: !!quizData.style,
            hasLanguage: !!quizData.language,
            hasId: !!quizData.id,
            quizData
          });
          
          // Validar que o quiz tem dados mínimos necessários
          // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
          const isQuizEmpty = !quizData.about_who && !quizData.style && !quizData.relationship;
          if (!quizData.about_who || !quizData.style) {
            logger.error('Quiz incompleto', {
              hasAboutWho: !!quizData.about_who,
              hasStyle: !!quizData.style,
              quizData
            });
            // ✅ Só mostrar toast se quiz não estiver completamente vazio
            if (!isQuizEmpty) {
              toast.error('Quiz incompleto. Por favor, preencha o quiz novamente.');
            }
            const quizPath = getQuizPath();
            logger.debug('Redirecionando para quiz (quiz incompleto)', { quizPath });
            navigateWithUtms(quizPath);
            return;
          }
          
          // Se existe draft, limpar para não interferir
          if (savedDraft) {
            logger.debug('Limpando draft antigo para usar novo quiz');
            localStorage.removeItem(draftKey);
          }
          
          setQuiz(quizData);
          setShouldRedirect(false);
          setLoading(false);
          logger.debug('Quiz carregado do localStorage');
          
          // Rastrear visualização do checkout (silencioso)
          try {
            if (typeof trackEvent === 'function') {
              trackEvent('checkout_viewed', {
                quiz_id: quizData.timestamp || 'unknown',
                about_who: quizData.about_who,
                style: quizData.style,
                language: quizData.language,
              });
            }
            
          } catch (trackError) {
            logger.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
          }
          
          return; // ✅ IMPORTANTE: Retornar aqui para não processar restore
        } catch (error) {
          logger.error('Error parsing quiz data do localStorage', error, {
            pendingQuizRaw: pendingQuiz?.substring(0, 200),
            pendingQuizLength: pendingQuiz?.length || 0,
            timestamp: new Date().toISOString(),
            url: window.location.href
          });
          
          // Se falhar ao parsear, continuar para verificar restore ou draft
          logger.warn('Erro ao parsear quiz do localStorage, continuando para verificar restore/draft');
        }
      }
      
      // ✅ PRIORIDADE 0.5: Se restore=true E a URL NÃO é da Cakto, verificar se deve redirecionar para Cakto
      // ⚠️ CRÍTICO: Se a URL contém parâmetros do checkout interno mas deveria ir para Cakto, redirecionar
      if (restore === 'true' && orderId && quizId && !window.location.href.includes('pay.cakto.com.br')) {
        // Verificar se há message_id (indica que veio do WhatsApp)
        const messageId = urlParams.get('message_id');
        if (messageId || auto === 'true') {
          // Se veio do WhatsApp (tem message_id) ou auto=true, redirecionar para Cakto
          logger.debug('URL do WhatsApp detectada com restore=true, redirecionando para Hotmart...');
          setLoading(true);
          
          try {
            // Buscar pedido PRIMEIRO (mais importante para redirecionamento)
            const { data: orderData, error: orderError } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single();
            
            if (orderError || !orderData) {
              logger.error('Erro ao buscar pedido para redirecionamento', orderError);
              // Continuar com fluxo normal se não conseguir buscar pedido
            } else if (orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.debug('Pedido encontrado, redirecionando para Hotmart...');
              const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
              if (redirectSuccess) {
                return; // Redirecionamento bem-sucedido, sair da função
              }
            }
          } catch (redirectError) {
            logger.error('Erro ao redirecionar para Hotmart', redirectError);
            // Continuar com fluxo normal se redirecionamento falhar
          }
        }
      }
      
      // ✅ PRIORIDADE 0.5 (LEGADO): Se auto=true E restore=true, redirecionar direto para Cakto
      if (auto === 'true' && restore === 'true' && orderId && quizId) {
        logger.debug('Modo automático detectado - redirecionando direto para Cakto', { auto, restore, orderId, quizId });
        setLoading(true);
        
        try {
          // Buscar pedido PRIMEIRO (mais importante para redirecionamento)
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (orderError || !orderData) {
            logger.error('Erro ao buscar pedido', orderError);
            toast.error('Pedido não encontrado');
            setLoading(false);
            const quizPath = getQuizPath();
            logger.debug('Redirecionando para quiz (pedido não encontrado)', { quizPath });
            navigateWithUtms(quizPath);
            return;
          }

          // Buscar quiz DEPOIS (pode falhar, mas não é crítico se temos dados do pedido)
          // Tentar primeiro via RPC (ignora RLS), depois via query normal
          let quizData = null;
          let quizError = null;
          
          try {
            logger.debug('Tentando buscar quiz via RPC...');
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_quiz_by_id', { quiz_id_param: quizId });
            
            // Verificar se função RPC não existe (erro específico)
            if (rpcError) {
              logger.warn('Erro ao chamar RPC', {
                message: rpcError.message,
                code: rpcError.code,
                details: rpcError.details
              });
              
              // Se função não existe (42883 = function does not exist), tentar query normal imediatamente
              if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
                logger.warn('Função RPC não existe, tentando query normal imediatamente...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              } else {
                // Outro erro, tentar query normal como fallback
                logger.warn('Erro na RPC, tentando query normal como fallback...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              }
            } else if (rpcData && rpcData.length > 0) {
              quizData = rpcData[0];
              logger.debug('Quiz encontrado via RPC');
            } else {
              // RPC retornou vazio, tentar query normal
              logger.warn('RPC retornou vazio, tentando query normal...');
              const { data: queryData, error: queryError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();
              
              quizData = queryData;
              quizError = queryError;
            }
          } catch (error) {
            logger.error('Erro ao buscar quiz', error);
            quizError = error;
          }

          if (quizError || !quizData) {
            logger.error('Erro ao buscar quiz no modo auto', quizError, {
              quizError: quizError?.message,
              code: quizError?.code,
              details: quizError?.details,
              quizId,
              orderId,
              hasQuizData: !!quizData
            });
            
            // Se auto=true, mesmo sem quiz, tentar redirecionar para Cakto usando dados do pedido
            // O quiz pode não ser encontrado por problemas de RLS, mas o pedido tem os dados necessários
            if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.warn('Quiz não encontrado, mas pedido tem dados. Tentando redirecionar para Hotmart mesmo assim...', {
                orderId: orderData.id,
                status: orderData.status,
                email: orderData.customer_email,
                whatsapp: orderData.customer_whatsapp,
                currentPath: window.location.pathname
              });
              
              // SEMPRE tentar redirecionar se auto=true e pedido tem dados, independente da rota
              const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
              
              if (redirectSuccess) {
                logger.debug('Redirecionamento para Hotmart iniciado com sucesso');
                return; // Não continuar o fluxo
              } else {
                logger.error('Falha ao redirecionar para Hotmart');
                // Continuar com restore normal abaixo
              }
            } else {
              logger.warn('Pedido não tem dados necessários para redirecionamento', {
                hasOrderData: !!orderData,
                status: orderData?.status,
                hasEmail: !!orderData?.customer_email,
                hasWhatsapp: !!orderData?.customer_whatsapp
              });
            }
            
            // Se não conseguiu redirecionar, tentar restore normal
            logger.warn('Quiz não encontrado no modo auto, tentando restore normal...');
            setLoading(false);
            // Não retornar aqui, deixar cair no bloco de restore abaixo
          } else {
            // Quiz encontrado, continuar com redirecionamento automático
            logger.debug('Quiz encontrado, continuando com redirecionamento automático');

            // Verificar se o quiz pertence ao pedido
            if (orderData.quiz_id !== quizId) {
              logger.error('Quiz não pertence ao pedido');
              toast.error('Quiz não corresponde ao pedido');
              setLoading(false);
              const quizPath = getQuizPath();
              logger.debug('Redirecionando para quiz (quiz não corresponde)', { quizPath });
              navigateWithUtms(quizPath);
              return;
            }

            // Verificar status do pedido
            if (orderData.status === 'paid') {
              logger.warn('Pedido já foi pago');
              toast.error('Este pedido já foi pago. Verifique seu email para mais detalhes.');
              setLoading(false);
              // Redirecionar para página de sucesso ou pedidos
              navigateWithUtms(`/payment/success?order_id=${orderId}`);
              return;
            }

            if (orderData.status !== 'pending') {
              logger.warn(`Pedido com status: ${orderData.status}`);
              toast.error(`Pedido com status: ${orderData.status}. Não é possível processar pagamento.`);
              setLoading(false);
              // Restaurar quiz para mostrar informações mesmo assim
              const restoredQuiz: QuizData = {
                id: quizData.id,
                about_who: quizData.about_who || '',
                relationship: quizData.relationship || '',
                style: quizData.style || '',
                language: quizData.language || 'pt',
                vocal_gender: quizData.vocal_gender || null,
                qualities: quizData.qualities || '',
                memories: quizData.memories || '',
                message: quizData.message || '',
                occasion: quizData.occasion || '',
                desired_tone: quizData.desired_tone || '',
                key_moments: quizData.key_moments || null,
                answers: quizData.answers || {},
                whatsapp: orderData.customer_whatsapp || '',
              };
              setEmail(orderData.customer_email || '');
              setWhatsapp(orderData.customer_whatsapp || '');
              setQuiz(restoredQuiz);
              setCameFromRestore(true);
              localStorage.setItem('pending_quiz', JSON.stringify(restoredQuiz));
              return; // Retornar para não tentar redirecionar
            }

            // Verificar se tem email e WhatsApp
            if (!orderData.customer_email || !orderData.customer_whatsapp) {
              logger.error('Pedido sem email ou WhatsApp');
              toast.error('Dados do cliente incompletos. Por favor, preencha os dados abaixo.');
              setLoading(false);
              // Restaurar quiz para mostrar formulário
              const restoredQuiz: QuizData = {
                id: quizData.id,
                about_who: quizData.about_who || '',
                relationship: quizData.relationship || '',
                style: quizData.style || '',
                language: quizData.language || 'pt',
                vocal_gender: quizData.vocal_gender || null,
                qualities: quizData.qualities || '',
                memories: quizData.memories || '',
                message: quizData.message || '',
                occasion: quizData.occasion || '',
                desired_tone: quizData.desired_tone || '',
                key_moments: quizData.key_moments || null,
                answers: quizData.answers || {},
                whatsapp: orderData.customer_whatsapp || '',
              };
              setEmail(orderData.customer_email || '');
              setWhatsapp(orderData.customer_whatsapp || '');
              setQuiz(restoredQuiz);
              setCameFromRestore(true);
              localStorage.setItem('pending_quiz', JSON.stringify(restoredQuiz));
              // Continuar com fluxo normal para preencher dados
              return; // Retornar para não tentar redirecionar
            } else {
              // ✅ Tudo OK - redirecionar direto para Hotmart
              // SEMPRE redirecionar se auto=true e pedido tem dados, independente da rota
              logger.debug('Quiz encontrado e pedido válido, redirecionando para Hotmart...');
              const redirectSuccess = await redirectToHotmart(
                orderData, 
                utms || {}, 
                quizData.language || 'pt'
              );
              
              if (redirectSuccess) {
                logger.debug('Redirecionamento para Hotmart iniciado com sucesso');
                return; // Não continuar o fluxo
              } else {
                logger.error('Falha ao redirecionar para Hotmart, restaurando quiz...');
                // Restaurar quiz para mostrar formulário normal
                const restoredQuiz: QuizData = {
                  id: quizData.id,
                  about_who: quizData.about_who || '',
                  relationship: quizData.relationship || '',
                  style: quizData.style || '',
                  language: quizData.language || 'pt',
                  vocal_gender: quizData.vocal_gender || null,
                  qualities: quizData.qualities || '',
                  memories: quizData.memories || '',
                  message: quizData.message || '',
                  occasion: quizData.occasion || '',
                  desired_tone: quizData.desired_tone || '',
                  key_moments: quizData.key_moments || null,
                  answers: quizData.answers || {},
                  whatsapp: orderData.customer_whatsapp || '',
                };
                setEmail(orderData.customer_email || '');
                setWhatsapp(orderData.customer_whatsapp || '');
                setQuiz(restoredQuiz);
                setCameFromRestore(true);
                localStorage.setItem('pending_quiz', JSON.stringify(restoredQuiz));
                setLoading(false);
                return;
              }
            }
          } // Fechar else do quiz encontrado
        } catch (error) {
          logger.error('Erro no redirecionamento automático', error);
          toast.error('Erro ao processar redirecionamento');
          setLoading(false);
          // Continuar com fluxo normal
        }
      }
      
      // ✅ PRIORIDADE 0: Se restore=true, verificar se deve redirecionar para Hotmart primeiro
      // ⚠️ CRÍTICO: Se a URL contém message_id (veio do WhatsApp), redirecionar para Hotmart ao invés de processar checkout interno
      if (restore === 'true' && orderId && quizId) {
        const messageIdFromUrl = urlParams.get('message_id');
        // Se tem message_id, significa que veio do WhatsApp e deve ir direto para Cakto
        if (messageIdFromUrl && !window.location.href.includes('pay.cakto.com.br')) {
          logger.debug('URL do WhatsApp detectada (tem message_id), redirecionando para Hotmart...');
          setLoading(true);
          
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single();
            
            if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.debug('Pedido encontrado, redirecionando para Hotmart...');
              const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
              if (redirectSuccess) {
                return; // Redirecionamento bem-sucedido, sair da função
              }
            }
          } catch (redirectError) {
            logger.error('Erro ao redirecionar para Hotmart', redirectError);
            // Continuar com fluxo normal se redirecionamento falhar
          }
        }
        
        logger.debug('Restaurando quiz do banco via URL', { orderId, quizId, token, messageId: messageIdFromUrl });
        try {
          // Tentar validar token se fornecido (opcional - não bloquear se token falhar)
          let linkValid = false;
          if (token) {
            const { data: linkData, error: linkError } = await supabase
              .from('checkout_links')
              .select('*')
              .eq('order_id', orderId)
              .eq('quiz_id', quizId)
              .eq('token', token)
              .gt('expires_at', new Date().toISOString())
              .is('used_at', null)
              .single();

            if (!linkError && linkData) {
              linkValid = true;
              logger.debug('Token válido');
            } else {
              logger.warn('Token inválido ou expirado, mas continuando com restore', { message: linkError?.message });
            }
          }

          // Buscar quiz e order do banco (mesmo se token falhar, pois temos order_id e quiz_id válidos)
          // Tentar primeiro via RPC (ignora RLS), depois via query normal
          let quizData = null;
          let quizError = null;
          
          try {
            logger.debug('Tentando buscar quiz via RPC no restore...');
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_quiz_by_id', { quiz_id_param: quizId });
            
            // Verificar se função RPC não existe (erro específico)
            if (rpcError) {
              logger.warn('Erro ao chamar RPC no restore', {
                message: rpcError.message,
                code: rpcError.code,
                details: rpcError.details
              });
              
              // Se função não existe (42883 = function does not exist), tentar query normal imediatamente
              if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
                logger.warn('Função RPC não existe, tentando query normal imediatamente...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              } else {
                // Outro erro, tentar query normal como fallback
                logger.warn('Erro na RPC, tentando query normal como fallback...');
                const { data: queryData, error: queryError } = await supabase
                  .from('quizzes')
                  .select('*')
                  .eq('id', quizId)
                  .single();
                
                quizData = queryData;
                quizError = queryError;
              }
            } else if (rpcData && rpcData.length > 0) {
              quizData = rpcData[0];
              logger.debug('Quiz encontrado via RPC no restore');
            } else {
              // RPC retornou vazio, tentar query normal
              logger.warn('RPC retornou vazio, tentando query normal...');
              const { data: queryData, error: queryError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();
              
              quizData = queryData;
              quizError = queryError;
            }
          } catch (error) {
            logger.error('Erro ao buscar quiz no restore', error);
            quizError = error;
          }

          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (quizError || !quizData) {
            logger.error('Erro ao buscar quiz no restore', quizError, {
              quizError: quizError?.message,
              quizErrorCode: quizError?.code,
              quizErrorDetails: quizError?.details,
              quizId,
              orderId,
              hasQuizData: !!quizData
            });
            
            // Se tem orderData mas não tem quiz, tentar redirecionar para Hotmart mesmo assim
            // Se auto=true, SEMPRE tentar redirecionar independente da rota
            if (!orderError && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.warn('Quiz não encontrado no restore, mas pedido tem dados. Tentando redirecionar para Hotmart...', { auto, orderId });
              
              // Se auto=true, sempre tentar redirecionar
              if (auto === 'true') {
                logger.debug('auto=true detectado, redirecionando para Hotmart...');
                const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
                
                if (redirectSuccess) {
                  logger.debug('Redirecionamento para Hotmart iniciado com sucesso');
                  return;
                } else {
                  logger.error('Falha ao redirecionar para Hotmart');
                }
              } else {
                logger.debug('auto não é true, não redirecionando automaticamente');
              }
            }
            
            // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
            const hasAnyQuizData = localStorage.getItem('pending_quiz') || sessionStorage.getItem('pending_quiz');
            if (!hasAnyQuizData) {
              // Quiz está vazio, não mostrar erro - apenas redirecionar silenciosamente
              logger.debug('Quiz vazio detectado, redirecionando silenciosamente para quiz');
            } else {
              toast.error(`Erro ao carregar quiz: ${quizError?.message || 'Quiz não encontrado'}`);
            }
            setLoading(false);
            // Continuar com fluxo normal - não retornar para tentar localStorage
          } else if (orderError || !orderData) {
            logger.error('❌ [Checkout] Erro ao buscar pedido no restore:', orderError);
            logger.error('❌ [Checkout] Detalhes:', {
              orderError: orderError?.message,
              orderErrorCode: orderError?.code,
              orderId,
              hasOrderData: !!orderData
            });
            toast.error(`Erro ao carregar pedido: ${orderError?.message || 'Pedido não encontrado'}`);
            setLoading(false);
            // Continuar com fluxo normal - não retornar para tentar localStorage
          } else {
            // Verificar se o quiz pertence ao pedido (segurança adicional)
            if (orderData.quiz_id !== quizId) {
              logger.error('❌ [Checkout] Quiz não pertence ao pedido:', {
                order_quiz_id: orderData.quiz_id,
                provided_quiz_id: quizId
              });
              toast.error('Quiz não corresponde ao pedido');
              // Continuar com fluxo normal
            } else {
              // Restaurar quiz do banco (INCLUINDO O ID)
              const restoredQuiz: QuizData = {
                id: quizData.id, // ✅ CRÍTICO: Incluir ID do quiz para reutilizar no checkout
                about_who: quizData.about_who || '',
                relationship: quizData.relationship || '',
                style: quizData.style || '',
                language: quizData.language || 'pt',
                vocal_gender: quizData.vocal_gender || null,
                qualities: quizData.qualities || '',
                memories: quizData.memories || '',
                message: quizData.message || '',
                occasion: quizData.occasion || '',
                desired_tone: quizData.desired_tone || '',
                key_moments: quizData.key_moments || null,
                answers: quizData.answers || {},
                whatsapp: orderData.customer_whatsapp || '',
              };

              setEmail(orderData.customer_email || '');
              setWhatsapp(orderData.customer_whatsapp || '');
              setQuiz(restoredQuiz);
              setCameFromRestore(true); // ✅ Marcar que veio do restore
              setLoading(false);
              
              // Salvar no localStorage também para persistência
              localStorage.setItem('pending_quiz', JSON.stringify(restoredQuiz));
              
              logger.debug('✅ [Checkout] Quiz restaurado do banco com sucesso:', {
                quiz_id: quizData.id,
                order_id: orderId,
                has_id: !!restoredQuiz.id,
                token_valid: linkValid,
                email: orderData.customer_email,
                whatsapp: orderData.customer_whatsapp
              });
              toast.success(t('checkout.errors.orderRecovered'));
              return;
            }
          }
        } catch (error) {
          logger.error('❌ [Checkout] Erro ao restaurar quiz:', error);
          
          // Se auto=true, tentar redirecionar para Hotmart mesmo com erro
          if (auto === 'true' && orderId) {
            logger.debug('⚠️ [Checkout] Erro no restore, mas auto=true. Tentando buscar pedido e redirecionar...');
            try {
              const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();
              
              if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
                logger.debug('✅ [Checkout] Pedido encontrado no fallback, redirecionando para Hotmart...');
                const redirectSuccess = await redirectToHotmart(orderData, utms || {}, 'pt');
                
                if (redirectSuccess) {
                  logger.debug('✅ [Checkout] Redirecionamento para Cakto iniciado com sucesso após erro');
                  return;
                } else {
                  logger.error('❌ [Checkout] Falha ao redirecionar para Hotmart no fallback');
                }
              } else {
                logger.warn('⚠️ [Checkout] Pedido não tem dados necessários no fallback:', {
                  hasOrderData: !!orderData,
                  status: orderData?.status,
                  hasEmail: !!orderData?.customer_email,
                  hasWhatsapp: !!orderData?.customer_whatsapp
                });
              }
          } catch (fallbackError) {
            logger.error('❌ [Checkout] Erro no fallback:', fallbackError);
          }
        }
        
        // ✅ Só exibir erro se realmente não houver quiz no localStorage ou sessionStorage
        const hasLocalQuiz = localStorage.getItem('pending_quiz');
        const hasSessionQuiz = sessionStorage.getItem('pending_quiz');
        
        if (!hasLocalQuiz && !hasSessionQuiz) {
          logger.error('❌ [Checkout] Erro ao restaurar quiz e não há quiz no localStorage/sessionStorage');
          // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
          const hasAnyQuizData = localStorage.getItem('pending_quiz') || sessionStorage.getItem('pending_quiz');
          if (hasAnyQuizData) {
            toast.error(t('checkout.errors.errorLoadingQuiz'));
          }
        } else {
          logger.debug('✅ [Checkout] Erro ao restaurar quiz, mas há quiz no localStorage/sessionStorage, continuando...');
        }
        // Continuar com fluxo normal para tentar carregar do localStorage
      }
    }
      
      // ✅ Se chegou aqui, não processou localStorage acima (ou restore=true ou não havia quiz)
      // Verificar localStorage novamente (pode ter sido adicionado durante o processamento)
      // ✅ Reutilizar variáveis já declaradas no início da função
      pendingQuiz = localStorage.getItem('pending_quiz');
      savedDraft = localStorage.getItem(draftKey);
    
      logger.debug('📋 [Checkout] Dados encontrados no localStorage:', {
        pendingQuiz: !!pendingQuiz,
        pendingQuizLength: pendingQuiz?.length || 0,
        savedDraft: !!savedDraft,
        savedDraftLength: savedDraft?.length || 0,
        pendingQuizContent: pendingQuiz ? (() => {
          try {
            return JSON.parse(pendingQuiz);
          } catch {
            return 'ERRO AO FAZER PARSE';
          }
        })() : null,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    
      // ✅ PRIORIDADE 1: Novo quiz SEMPRE tem prioridade (se não foi processado acima e não há restore)
      if (pendingQuiz && restore !== 'true') {
        try {
          const quizData = JSON.parse(pendingQuiz);
          logger.debug('✅ [Checkout] Quiz data parseado com sucesso:', {
            hasAboutWho: !!quizData.about_who,
            hasStyle: !!quizData.style,
            hasLanguage: !!quizData.language,
            hasId: !!quizData.id,
            quizData
          });
          
          // Validar que o quiz tem dados mínimos necessários
          if (!quizData.about_who || !quizData.style) {
            logger.error('❌ [Checkout] Quiz incompleto:', {
              hasAboutWho: !!quizData.about_who,
              hasStyle: !!quizData.style,
              quizData
            });
            // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
            const isQuizEmpty = !quizData.about_who && !quizData.style && !quizData.relationship;
            if (!isQuizEmpty) {
              toast.error('Quiz incompleto. Por favor, preencha o quiz novamente.');
            }
            // ✅ NÃO limpar quiz imediatamente - manter para debug
            // localStorage.removeItem('pending_quiz'); // Comentado para debug
            logger.warn('⚠️ [Checkout] Quiz incompleto mantido no localStorage para debug');
            const quizPath = getQuizPath();
            logger.debug('🔄 [Checkout] Redirecionando para quiz (quiz incompleto)', { quizPath });
            navigateWithUtms(quizPath);
            return;
          }
          
          // Se existe draft, limpar para não interferir
          if (savedDraft) {
            logger.debug('🗑️ [Checkout] Limpando draft antigo para usar novo quiz');
            localStorage.removeItem(draftKey);
          }
          
          setQuiz(quizData);
          setShouldRedirect(false); // Resetar flag de redirecionamento
          setLoading(false);
          logger.debug('✅ [Checkout] Quiz carregado do localStorage');
          
          // Rastrear visualização do checkout (silencioso)
          try {
            if (typeof trackEvent === 'function') {
              trackEvent('checkout_viewed', {
                quiz_id: quizData.timestamp || 'unknown',
                about_who: quizData.about_who,
                style: quizData.style,
                language: quizData.language,
              });
            }
            
          } catch (trackError) {
            logger.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
          }
          
          return;
        } catch (error) {
          logger.error('❌ [Checkout] Error parsing quiz data:', {
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : undefined,
            pendingQuizRaw: pendingQuiz?.substring(0, 200),
            pendingQuizLength: pendingQuiz?.length || 0,
            errorStack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
            url: window.location.href
          });
          
          // Tentar verificar se é um problema de JSON malformado
          if (pendingQuiz) {
            try {
              // Tentar ver se consegue identificar o problema
              const firstChar = pendingQuiz[0];
              const lastChar = pendingQuiz[pendingQuiz.length - 1];
              logger.error('❌ [Checkout] Análise do JSON inválido:', {
                firstChar,
                lastChar,
                startsWithBrace: firstChar === '{',
                endsWithBrace: lastChar === '}',
                length: pendingQuiz.length
              });
            } catch (analysisError) {
              logger.error('❌ [Checkout] Erro ao analisar JSON:', analysisError);
            }
          }
          
          // ✅ Tentar verificar se há quiz válido no sessionStorage como fallback (silencioso)
          const sessionQuiz = sessionStorage.getItem('pending_quiz');
          if (sessionQuiz) {
            try {
              const sessionQuizData = JSON.parse(sessionQuiz);
              if (sessionQuizData.about_who && sessionQuizData.style) {
                logger.debug('✅ [Checkout] Quiz encontrado no sessionStorage, restaurando silenciosamente...');
                // Restaurar do sessionStorage para localStorage (sem toast)
                localStorage.setItem('pending_quiz', sessionQuiz);
                setQuiz(sessionQuizData);
                setShouldRedirect(false);
                setLoading(false);
                // Não mostrar toast - fluxo silencioso
                return;
              }
            } catch (sessionError) {
              logger.error('❌ [Checkout] Erro ao restaurar do sessionStorage:', sessionError);
            }
          }
          
          // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
          const hasAnyQuizData = localStorage.getItem('pending_quiz') || sessionStorage.getItem('pending_quiz');
          if (hasAnyQuizData) {
            toast.error(t('checkout.errors.errorLoadingQuiz'));
          }
          // ✅ NÃO limpar quiz imediatamente - manter para debug
          // localStorage.removeItem('pending_quiz'); // Comentado para debug
          logger.warn('⚠️ [Checkout] Quiz inválido mantido no localStorage para debug');
          
          // Aguardar um pouco antes de redirecionar para dar chance de ver o erro
          setTimeout(() => {
            const quizPath = getQuizPath();
            logger.debug('🔄 [Checkout] Redirecionando para quiz com caminho completo', { quizPath });
            navigateWithUtms(quizPath);
          }, 2000);
          return;
        }
      }
    
    // ✅ PRIORIDADE 1.5: Verificar parâmetros da URL da Cakto para pré-preencher email e WhatsApp
    const urlEmail = urlParams.get('email');
    // Cakto retorna 'phone' na URL (não 'whatsapp')
    const urlWhatsapp = urlParams.get('phone') || urlParams.get('whatsapp');
    if (urlEmail || urlWhatsapp) {
      logger.debug('✅ [Checkout] Parâmetros da URL detectados:', { urlEmail: !!urlEmail, urlWhatsapp: !!urlWhatsapp });
      if (urlEmail) {
        setEmail(urlEmail);
        logger.debug('✅ [Checkout] Email pré-preenchido da URL', { urlEmail });
      }
      if (urlWhatsapp) {
        // Formatar WhatsApp se necessário
        const formattedWhatsapp = urlWhatsapp.replace(/\D/g, '');
        if (formattedWhatsapp.length >= 10) {
          // Formatar como (XX) XXXXX-XXXX se tiver 11 dígitos ou (XX) XXXX-XXXX se tiver 10
          let formatted = formattedWhatsapp;
          if (formatted.length === 11) {
            formatted = `(${formatted.slice(0, 2)}) ${formatted.slice(2, 7)}-${formatted.slice(7)}`;
          } else if (formatted.length === 10) {
            formatted = `(${formatted.slice(0, 2)}) ${formatted.slice(2, 6)}-${formatted.slice(6)}`;
          }
          setWhatsapp(formatted);
          logger.debug('✅ [Checkout] WhatsApp pré-preenchido da URL', { formatted });
        } else {
          setWhatsapp(urlWhatsapp);
          logger.debug('✅ [Checkout] WhatsApp pré-preenchido da URL (sem formatação)', { urlWhatsapp });
        }
      }
    }

    // PRIORIDADE 2: Recuperar draft apenas se NÃO houver novo quiz
    if (savedDraft) {
      try {
        const draft: CheckoutDraft = JSON.parse(savedDraft);
        // Verificar se draft não é muito antigo (> 1 hora)
        if (Date.now() - draft.timestamp < 3600000) {
          // Só usar draft se não houver dados da URL
          if (!urlEmail) setEmail(draft.email);
          if (!urlWhatsapp) setWhatsapp(draft.whatsapp || '');
          setQuiz(draft.quizData);
          setShouldRedirect(false); // Resetar flag de redirecionamento
          setLoading(false);
          logger.debug('✅ Draft carregado, loading set to false');
          
          // Rastrear visualização do checkout (draft restaurado)
          try {
            if (typeof trackEvent === 'function') {
              trackEvent('checkout_viewed', {
                quiz_id: draft.quizData.timestamp || 'unknown',
                about_who: draft.quizData.about_who,
                style: draft.quizData.style,
                language: draft.quizData.language,
                source: 'draft_restored',
              });
            }
            
          } catch (trackError) {
            logger.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
          }
          
          toast.info(t('checkout.errors.orderRecovered'));
          return;
        }
      } catch (error) {
        logger.error('Error loading draft:', error);
      }
    }
    
    // Sem quiz e sem draft: verificar sessionStorage como fallback
    logger.error('❌ [Checkout] Nenhum quiz ou draft encontrado no localStorage', {
      hasPendingQuiz: !!pendingQuiz,
      hasSavedDraft: !!savedDraft,
      localStorageKeys: Object.keys(localStorage).filter(k => k.includes('quiz') || k.includes('draft')),
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    
    // ✅ FALLBACK: Tentar buscar do sessionStorage (silencioso)
    const sessionQuiz = sessionStorage.getItem('pending_quiz');
    if (sessionQuiz) {
      logger.debug('✅ [Checkout] Quiz encontrado no sessionStorage, restaurando silenciosamente...');
      try {
        const sessionQuizData = JSON.parse(sessionQuiz);
        if (sessionQuizData.about_who && sessionQuizData.style) {
          // Restaurar do sessionStorage para localStorage (sem toast)
          localStorage.setItem('pending_quiz', sessionQuiz);
          setQuiz(sessionQuizData);
          setShouldRedirect(false);
          setLoading(false);
          // Não mostrar toast - fluxo silencioso como antes
          logger.debug('✅ [Checkout] Quiz restaurado do sessionStorage com sucesso');
          return;
        } else {
          logger.warn('⚠️ [Checkout] Quiz do sessionStorage está incompleto');
        }
      } catch (error) {
        logger.error('❌ [Checkout] Erro ao restaurar do sessionStorage:', error);
      }
    }
    
    setLoading(false); // Importante: setar loading como false antes de redirecionar
    
    // ✅ Consolidar mensagens de erro - mostrar apenas uma
    // ✅ CORREÇÃO: Não mostrar notificação se quiz estiver vazio/zerado
    const hasAnyQuizData = localStorage.getItem('pending_quiz') || sessionStorage.getItem('pending_quiz');
    if (!toastShownRef.current && hasAnyQuizData) {
      toast.error(t('checkout.errors.quizNotFound'));
      toastShownRef.current = true;
    } else if (!hasAnyQuizData) {
      // Quiz está vazio, apenas logar sem mostrar toast
      logger.debug('Quiz vazio detectado, redirecionando silenciosamente para quiz');
    }
    
    // Usar requestAnimationFrame para evitar problemas de CSP
    requestAnimationFrame(() => {
      if (!isRedirectingRef.current) {
        const quizPath = getQuizPath();
        logger.debug('🔄 [Checkout] Executando redirecionamento para quiz com caminho completo', { quizPath });
        isRedirectingRef.current = true;
        navigateWithUtms(quizPath);
      }
    });
    };
    
      // ✅ Executar processamento apenas uma vez
      processLocalStorage();
      
      // ✅ MELHORADO: Múltiplas tentativas de retry com intervalos crescentes
      // Isso ajuda em casos de timing onde o localStorage pode não estar disponível imediatamente
      const retryTimeouts: ReturnType<typeof setTimeout>[] = [];
      
      // Retry 1: após 200ms (aumentado de 100ms)
      const retry1 = setTimeout(() => {
      const retryPendingQuiz = localStorage.getItem('pending_quiz');
      logger.debug('🔄 [Checkout] Retry 1 (200ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz && !quiz) {
        logger.warn('⚠️ [Checkout] Retry 1: Quiz ainda não encontrado após 200ms');
        // Continuar para próximo retry
      } else if (retryPendingQuiz && !quiz) {
        logger.debug('✅ [Checkout] Retry 1: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            logger.debug('✅ [Checkout] Quiz carregado no retry 1');
            return; // Sucesso, não precisa mais retries
          } else {
            logger.warn('⚠️ [Checkout] Retry 1: Quiz encontrado mas incompleto');
          }
        } catch (retryError) {
          logger.error('❌ [Checkout] Erro no retry 1:', retryError);
        }
      }
    }, 100);
    retryTimeouts.push(retry1);
    
    // Retry 2: após 500ms (total 500ms)
    const retry2 = setTimeout(() => {
      if (quiz) {
        logger.debug('✅ [Checkout] Retry 2: Quiz já carregado, cancelando retry');
        return; // Quiz já foi carregado
      }
      
      const retryPendingQuiz = localStorage.getItem('pending_quiz');
      logger.debug('🔄 [Checkout] Retry 2 (500ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz) {
        logger.warn('⚠️ [Checkout] Retry 2: Quiz ainda não encontrado após 500ms');
        // Continuar para próximo retry
      } else {
        logger.debug('✅ [Checkout] Retry 2: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            logger.debug('✅ [Checkout] Quiz carregado no retry 2');
            return; // Sucesso
          } else {
            logger.warn('⚠️ [Checkout] Retry 2: Quiz encontrado mas incompleto:', {
              hasAboutWho: !!retryQuizData.about_who,
              hasStyle: !!retryQuizData.style
            });
          }
        } catch (retryError) {
          logger.error('❌ [Checkout] Erro no retry 2:', {
            error: retryError instanceof Error ? retryError.message : String(retryError),
            errorStack: retryError instanceof Error ? retryError.stack : undefined
          });
        }
      }
    }, 500);
    retryTimeouts.push(retry2);
    
    // Retry 3: após 1000ms (total 1s)
    const retry3 = setTimeout(() => {
      if (quiz) {
        logger.debug('✅ [Checkout] Retry 3: Quiz já carregado, cancelando retry');
        return; // Quiz já foi carregado
      }
      
      const retryPendingQuiz = localStorage.getItem('pending_quiz');
      logger.debug('🔄 [Checkout] Retry 3 (1000ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz) {
        logger.error('❌ [Checkout] Retry 3: Quiz ainda não encontrado após 1 segundo');
        logger.error('❌ [Checkout] Todos os retries falharam. Verificando localStorage completo:', {
          allKeys: Object.keys(localStorage),
          pendingQuizKeys: Object.keys(localStorage).filter(k => k.includes('quiz') || k.includes('draft')),
          timestamp: new Date().toISOString()
        });
        // Não redirecionar aqui, deixar o processLocalStorage acima tratar
      } else {
        logger.debug('✅ [Checkout] Retry 3: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            logger.debug('✅ [Checkout] Quiz carregado no retry 3 (última tentativa)');
          } else {
            logger.error('❌ [Checkout] Retry 3: Quiz encontrado mas incompleto:', {
              hasAboutWho: !!retryQuizData.about_who,
              hasStyle: !!retryQuizData.style,
              retryQuizData
            });
          }
        } catch (retryError) {
          logger.error('❌ [Checkout] Erro no retry 3 (última tentativa):', {
            error: retryError instanceof Error ? retryError.message : String(retryError),
            errorStack: retryError instanceof Error ? retryError.stack : undefined,
            pendingQuizRaw: retryPendingQuiz?.substring(0, 200)
          });
        }
      }
    }, 1000);
      retryTimeouts.push(retry3);
    };

    // ✅ OTIMIZAÇÃO: Executar após primeiro paint para não bloquear renderização
    // ✅ OTIMIZAÇÃO FASE 3.1: Reduzir timeout para carregar mais rápido
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(executeAfterPaint, { timeout: 50 });
    } else {
      // Fallback: usar requestAnimationFrame + setTimeout com delay menor
      requestAnimationFrame(() => {
        setTimeout(executeAfterPaint, 0);
      });
    }
    
    return () => {
      // Cleanup será feito dentro do executeAfterPaint quando necessário
    };
  }, [navigateWithUtms, utms]); // ✅ Executar apenas uma vez ao montar o componente


  // ✅ REFATORAÇÃO: Limpeza de áudio agora está no hook useCheckoutAudio

  // ✅ REFATORAÇÃO: validateEmail, validateWhatsApp e formatWhatsApp agora vêm do hook useCheckoutForm

  // FASE 2: Salvar draft no localStorage
  const saveDraft = (transactionId: string) => {
    if (!quiz) return;
    
    const draft: CheckoutDraft = {
      email,
      whatsapp,
      planId: selectedPlan,
      quizData: quiz,
      transactionId,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('checkout_draft', JSON.stringify(draft));
    } catch (error) {
      logger.error('Error saving draft:', error);
    }
  };

  // Função auxiliar para extrair mensagem de erro de forma consistente
  // Definida fora do try para estar acessível em todos os catch blocks
  const extractErrorMessage = (error: unknown, result?: { data?: unknown; error?: unknown }): string => {
    // 1. Tentar de result.data (edge function retorna { success: false, error: "..." })
    if (result?.data && typeof result.data === 'object') {
      const data = result.data as { error?: string; message?: string; success?: boolean };
      if (data.error) return data.error;
      if (data.message && data.success === false) return data.message;
    }
    
    // 2. Tentar de result.error
    if (result?.error && typeof result.error === 'object') {
      const err = result.error as { message?: string; context?: { body?: unknown } };
      if (err.message) {
        // Tentar extrair do body se disponível
        if (err.context?.body) {
          try {
            const body = typeof err.context.body === 'string' 
              ? JSON.parse(err.context.body) 
              : err.context.body;
            const bodyObj = body as { error?: string; message?: string };
            if (bodyObj?.error) return bodyObj.error;
            if (bodyObj?.message) return bodyObj.message;
          } catch {
            // Ignorar erro de parsing
          }
        }
        return err.message;
      }
    }
    
    // 3. Tentar do erro direto
    if (error && typeof error === 'object') {
      const err = error as { message?: string; error?: string; context?: { body?: unknown } };
      
      // Tentar extrair do context.body se disponível
      if (err.context?.body) {
        try {
          const body = typeof err.context.body === 'string' 
            ? JSON.parse(err.context.body) 
            : err.context.body;
          const bodyObj = body as { error?: string; message?: string };
          if (bodyObj?.error) return bodyObj.error;
          if (bodyObj?.message) return bodyObj.message;
        } catch {
          // Ignorar erro de parsing
        }
      }
      
      if (err.error) return String(err.error);
      if (err.message) return err.message;
    }
    
    // 4. Fallback
    return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
  };

  // Checkout com Stripe ou Cakto (baseado no locale)
  const handleCheckout = async (isRetry = false) => {
    // Criar logger local ANTES de usar qualquer logger
    const checkoutLogger = createCheckoutLogger();
    const transactionId = checkoutLogger.getTransactionId();
    
    logger.debug('handleCheckout chamado', { isRetry, processing, hasEmail: !!email, hasWhatsapp: !!whatsapp, hasQuiz: !!quiz });
    
    // Debounce: prevenir cliques duplicados
    if (processing) {
      logger.warn('Já está processando, ignorando');
      return;
    }
    
    const now = Date.now();
    if (now - lastClickTime < 2000) {
      logger.warn('Clique muito rápido, aguardando', { timeSinceLastClick: now - lastClickTime });
      return;
    }
    setLastClickTime(now);
    logger.debug('Processando checkout...');

    // Validar email e mostrar erro se necessário
    const isEmailValid = validateEmail();
    if (!isEmailValid) {
      setButtonError(true);
      toast.error(t('checkout.errors.enterValidEmail'));
      // Fazer scroll para o campo de email se houver erro
      const emailInput = document.querySelector('input[type="email"]') as HTMLElement;
      if (emailInput) {
        emailInput.focus();
        emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Remover erro após 3 segundos
      setTimeout(() => setButtonError(false), 3000);
      return;
    }

    // Validar WhatsApp e mostrar erro se necessário
    const isWhatsAppValid = validateWhatsApp();
    if (!isWhatsAppValid) {
      setButtonError(true);
      toast.error(t('checkout.whatsappError.required') || 'WhatsApp é obrigatório');
      // Fazer scroll para o campo de WhatsApp se houver erro
      const whatsappInput = document.querySelector('input[type="tel"]') as HTMLElement;
      if (whatsappInput) {
        whatsappInput.focus();
        whatsappInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Remover erro após 3 segundos
      setTimeout(() => setButtonError(false), 3000);
      return;
    }

    // Limpar erro do botão se validações passaram
    setButtonError(false);

    if (!quiz) {
      toast.error(t('checkout.errors.errorProcessing'));
      return;
    }

    // ✅ Definir processing=true imediatamente após validações para mostrar "Processando..."
    // ✅ IMPORTANTE: Este estado NÃO deve ser resetado antes do redirecionamento quando tudo está correto
    // ✅ O botão ficará em loading até o redirecionamento acontecer
    setProcessing(true);

    // ✅ OTIMIZAÇÃO: Rastreamento não bloqueante (fire and forget) - mover para background
    setTimeout(() => {
      if (typeof trackEvent === 'function') {
        trackEvent('checkout_form_filled', {
          plan: selectedPlan,
          has_email: !!email,
          has_whatsapp: !!whatsapp,
          about_who: quiz.about_who,
          style: quiz.style,
        }).catch(() => {});
      }
    }, 0);
    

    // ✅ Determinar gateway (sempre Hotmart)
    const selectedGateway = getPaymentGateway();
    
    logger.debug('🌍 [Checkout] Sistema de pagamento:', {
      currentPath: window.location.pathname,
      paymentProvider: selectedGateway
    });

    // ✅ OTIMIZAÇÃO: Limpar drafts em background (não bloqueante)
    setTimeout(() => {
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('checkout_logs_') || key === 'checkout_draft_old') {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        void error;
      }
    }, 0);

    // FASE 1 & 3: Usar checkoutLogger já criado no início da função
    checkoutLogger.log('checkout_started', { 
      email, 
      plan: selectedPlan, 
      retry: isRetry,
      retryCount 
    });

    // FASE 2: Salvar draft
    saveDraft(transactionId);

    // Variável para armazenar o pedido criado (para redirecionamento em caso de erro)
    let orderCreated: any = null;

    try {
      const plan = plans.find(p => p.id === selectedPlan);
      
      if (!plan) {
        logger.error('Plano não encontrado', undefined, { step: 'plan_validation', selectedPlan, availablePlans: plans.map(p => p.id) });
        throw new Error('Plano não encontrado');
      }

      // Validar que plan.price existe e é um número válido
      if (typeof plan.price !== 'number' || plan.price <= 0) {
        logger.error('Preço do plano inválido', undefined, { step: 'plan_validation', planPrice: plan.price });
        throw new Error('Preço do plano inválido');
      }

      // PASSO 1: Criar Quiz
      checkoutLogger.log('quiz_creation_started', { email });

      // 🌍 Detectar idioma atual do usuário
      const currentLanguage = getCurrentLanguage();
      
      // ✅ OTIMIZAÇÃO: Usar dados já normalizados (evita processamento no clique)
      const normalizedWhatsApp = normalizedWhatsAppRef.current || formatWhatsappForCakto(whatsapp);
      const normalizedEmail = normalizedEmailRef.current || sanitizeEmail(email);
      
      // Atualizar refs se ainda não foram normalizados
      if (!normalizedEmailRef.current) normalizedEmailRef.current = normalizedEmail;
      if (!normalizedWhatsAppRef.current) normalizedWhatsAppRef.current = normalizedWhatsApp;
      
      // ✅ OTIMIZAÇÃO CRÍTICA: Salvar quiz completo no localStorage ANTES de qualquer coisa
      // Isso garante que os dados não sejam perdidos mesmo se o redirecionamento acontecer antes do banco
      const quizForLocalStorage = {
        ...quiz,
        customer_email: normalizedEmail,
        customer_whatsapp: normalizedWhatsApp,
        plan: selectedPlan,
        timestamp: new Date().toISOString(),
        saved_at: Date.now()
      };
      try {
        localStorage.setItem('pending_quiz', JSON.stringify(quizForLocalStorage));
        localStorage.setItem('checkout_ready', 'true');
        localStorage.setItem('checkout_email', normalizedEmail);
        localStorage.setItem('checkout_whatsapp', normalizedWhatsApp);
        localStorage.setItem('selected_plan', selectedPlan);
        localStorage.setItem('checkout_timestamp', Date.now().toString());
      } catch (e) {
        logger.warn('Erro ao salvar no localStorage (não crítico)', e);
      }
      
      // ✅ Obter session_id e amount_cents antes de redirecionar
      const quizSessionIdForRedirect = (() => {
        if (typeof quiz.session_id === 'string' && quiz.session_id.trim() !== '') return quiz.session_id;
        const answersSessionId = quiz.answers?.['session_id'];
        if (answersSessionId && typeof answersSessionId === 'string' && answersSessionId.trim() !== '') return answersSessionId;
        return getOrCreateQuizSessionId();
      })();
      
      const hotmartConfigForRedirect = getHotmartConfig();
      const amountCentsForRedirect = hotmartConfigForRedirect.amount_cents;
      
      // ✅ OTIMIZAÇÃO ULTRA-RÁPIDA: Gerar URL do gateway ANTES de processar banco
      const paymentGatewayForRedirect = getPaymentGateway();
      let redirectUrl: string;
      
      // Sempre usar Hotmart
      const hotmartConfig = getHotmartConfig();
      // Gerar URL da Hotmart com order_id temporário (será atualizado quando order for criado)
      redirectUrl = generateHotmartUrl(
        'pending', // Será atualizado quando order for criado
        normalizedEmail,
        normalizedWhatsApp,
        currentLanguage,
        utms || {}
      );
      
      // ✅ Preparar dados do quiz para checkout (antes de redirecionar)
      const quizForCheckoutPrep = {
        about_who: quiz.about_who,
        relationship: quiz.relationship,
        style: quiz.style,
        language: currentLanguage,
        vocal_gender: quiz.vocal_gender || null,
        qualities: quiz.qualities,
        memories: quiz.memories,
        message: quiz.message || null,
        key_moments: quiz.key_moments || null,
        occasion: quiz.occasion || null,
        desired_tone: quiz.desired_tone || null,
        answers: quiz.answers || {}
      };
      
      // ✅ Salvar no banco em background (não bloqueante) usando sendBeacon
      const saveToDatabaseInBackground = () => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
          const checkoutData = {
            session_id: quizSessionIdForRedirect,
            quiz: quizForCheckoutPrep,
            customer_email: normalizedEmail,
            customer_whatsapp: normalizedWhatsApp,
            plan: selectedPlan,
            amount_cents: amountCentsForRedirect,
            provider: 'hotmart', // Sempre usar Hotmart como método de pagamento
            transaction_id: transactionId
          };
          
          const data = JSON.stringify(checkoutData);
          
          // Usar sendBeacon (funciona mesmo após navegação)
          if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            const url = `${supabaseUrl}/functions/v1/create-checkout`;
            const sent = navigator.sendBeacon(url, blob);
            if (sent) {
              logger.debug('✅ [Checkout] Dados enviados via sendBeacon para salvar em background');
            }
          }
        } catch (e) {
          // Ignorar erros - dados já estão no localStorage
        }
      };
      
      // ✅ Iniciar salvamento em background (não bloqueia)
      saveToDatabaseInBackground();
      
      // ✅ REDIRECIONAR IMEDIATAMENTE (não esperar banco)
      logger.info('🚀 [Checkout] Redirecionando IMEDIATAMENTE (dados salvos no localStorage)', {
        url: redirectUrl.substring(0, 100),
        hasQuizInStorage: true,
        gateway: paymentGatewayForRedirect
      });
      
      // ✅ REDIRECIONAR AGORA - dados já estão salvos no localStorage
      window.location.href = redirectUrl;
      return; // Sair da função - redirecionamento já iniciado
      
    } catch (error: unknown) {
      setProcessing(false);
      setLastClickTime(0); // Resetar para permitir nova tentativa
      
      // Usar a função extractErrorMessage que já foi definida no escopo acima
      const actualErrorMessage = extractErrorMessage(error);
      
      // ✅ OTIMIZAÇÃO: Log e tracking de erro em background (não bloqueante)
      setTimeout(() => {
        try {
          if (typeof trackEvent === 'function') {
            trackEvent('payment_error', {
              order_id: 'unknown',
              plan: selectedPlan,
              error_message: actualErrorMessage,
              payment_provider: 'hotmart', // Sempre usar Hotmart como método de pagamento
            }).catch(() => {});
          }
        } catch (error) {
          void error;
        }
      }, 0);
      
      // Mapa de mensagens amigáveis
      const errorMessages: Record<string, string> = {
        'Chave de API do Stripe expirada': 'Sistema de pagamento temporariamente indisponível. Contate o suporte para resolver.',
        'api_key_expired': 'Sistema de pagamento temporariamente indisponível. Contate o suporte para resolver.',
        'Expired API Key': 'Sistema de pagamento temporariamente indisponível. Contate o suporte para resolver.',
        'Chave de API do Stripe inválida': 'Sistema de pagamento não configurado corretamente. Contate o suporte.',
        'api_key_invalid': 'Sistema de pagamento não configurado corretamente. Contate o suporte.',
        'Invalid API Key': 'Sistema de pagamento não configurado corretamente. Contate o suporte.',
        'Chave de API do Stripe não configurada': 'Sistema de pagamento não configurado. Contate o suporte.',
        'STRIPE_SECRET_KEY não configurado': 'Sistema de pagamento não configurado. Contate o suporte.',
        'STRIPE_SECRET_KEY': 'Sistema de pagamento não configurado. Contate o suporte.',
        'Tempo limite excedido': 'Tempo limite excedido. Verifique sua conexão e tente novamente.',
        'Email inválido': 'Email inválido. Verifique e tente novamente.',
        'Order já foi paga': 'Este pedido já foi pago.',
        'Email não corresponde ao pedido': 'Email não corresponde ao pedido.',
        'Order não encontrada': 'Pedido não encontrado. Por favor, tente novamente.',
        'rate limit': 'Muitas tentativas. Por favor, aguarde alguns minutos e tente novamente.',
        'Price não encontrado': 'Erro na configuração de preços. Contate o suporte.',
        'Parâmetros obrigatórios': 'Erro ao processar pagamento. Verifique os dados e tente novamente.',
        'Resposta do Stripe incompleta': 'Resposta do servidor de pagamento incompleta. Tente novamente.',
        'Resposta do servidor de pagamento está vazia': 'Resposta do servidor de pagamento está vazia. Tente novamente.',
        'URLs de redirecionamento inválidas': 'Erro na configuração de URLs. Contate o suporte.',
        'Plano': 'Plano selecionado não é válido. Tente novamente.'
      };

      // Buscar mensagem amigável
      let finalErrorMessage = actualErrorMessage;
      for (const [key, friendly] of Object.entries(errorMessages)) {
        if (actualErrorMessage.toLowerCase().includes(key.toLowerCase())) {
          finalErrorMessage = friendly;
          break;
        }
      }
      
      // Se ainda for genérico, tentar usar mensagem original se for mais específica
      if (finalErrorMessage === 'Erro desconhecido' || (finalErrorMessage.length < 10 && actualErrorMessage.length > 10)) {
        finalErrorMessage = actualErrorMessage.length > 100 
          ? actualErrorMessage.substring(0, 100) + '...'
          : actualErrorMessage;
      }
      
      // Garantir que sempre há uma mensagem
      if (!finalErrorMessage || finalErrorMessage.trim().length === 0) {
        finalErrorMessage = 'Erro ao processar pagamento. Por favor, tente novamente ou entre em contato com o suporte.';
      }

      logger.debug('Mensagem final de erro', { finalErrorMessage });

      toast.error(finalErrorMessage, {
        duration: 5000,
        action: {
          label: 'Tentar Novamente',
          onClick: () => {
            handleCheckout(false);
          }
        }
      });
    }
  };

  // ✅ REFATORAÇÃO: togglePlay e formatTime agora vêm do hook useCheckoutAudio

  // ✅ MOVER useEffect ANTES dos return early para evitar erro de hooks
  // Verificar se quiz está carregado - usar useEffect para redirecionar apenas após tentativas de carregamento
  useEffect(() => {
    // ✅ Evitar redirecionamentos múltiplos
    if (isRedirectingRef.current) {
      logger.debug('⚠️ [Checkout] Já está redirecionando, ignorando...');
      return;
    }
    
    // ✅ Se tem quiz no estado, não redirecionar
    if (quiz) {
      logger.debug('✅ [Checkout] Quiz encontrado no estado, não redirecionando');
      return;
    }
    
    // ✅ Se ainda está carregando, aguardar
    if (loading) {
      logger.debug('⏳ [Checkout] Ainda carregando, aguardando...');
      return;
    }
    
    // ✅ Verificar se já processou - se não processou ainda, aguardar
    if (!hasProcessedRef.current) {
      logger.debug('⚠️ [Checkout] Ainda não processou, aguardando...');
      return;
    }
    
    // ✅ VERIFICAÇÃO CRÍTICA: Verificar localStorage ANTES de redirecionar
    // Isso evita redirecionamento quando o quiz foi carregado mas o estado ainda não atualizou
    const localStorageQuiz = localStorage.getItem('pending_quiz');
    const sessionStorageQuiz = sessionStorage.getItem('pending_quiz');
    
    if (localStorageQuiz || sessionStorageQuiz) {
      logger.debug('✅ [Checkout] Quiz encontrado no localStorage/sessionStorage, aguardando atualização do estado...', {
        hasLocalStorage: !!localStorageQuiz,
        hasSessionStorage: !!sessionStorageQuiz,
        timestamp: new Date().toISOString()
      });
      
      // Aguardar mais um pouco para dar tempo ao estado atualizar
      const checkTimeout = setTimeout(() => {
        // Verificar novamente se o quiz foi carregado no estado
        if (quiz) {
          logger.debug('✅ [Checkout] Quiz foi carregado no estado após verificação');
          return;
        }
        
        // Se ainda não tem quiz no estado, tentar carregar manualmente
        if (localStorageQuiz) {
          try {
            const quizData = JSON.parse(localStorageQuiz);
            if (quizData.about_who && quizData.style) {
              logger.debug('✅ [Checkout] Carregando quiz do localStorage manualmente após timeout');
              setQuiz(quizData);
              setLoading(false);
              return;
            }
          } catch (error) {
            logger.error('❌ [Checkout] Erro ao carregar quiz do localStorage manualmente:', error);
          }
        }
      }, 500);
      
      return () => clearTimeout(checkTimeout);
    }
    
    // Aguardar um pouco antes de redirecionar para dar tempo ao retry
    const redirectTimeout = setTimeout(() => {
      // ✅ Verificar novamente ANTES de redirecionar (quiz pode ter sido carregado)
      // Verificar tanto o estado quanto o localStorage
      const finalCheck = localStorage.getItem('pending_quiz') || sessionStorage.getItem('pending_quiz');
      
      if (quiz || finalCheck) {
        logger.debug('✅ [Checkout] Quiz encontrado antes do redirecionamento, cancelando redirecionamento');
        if (finalCheck && !quiz) {
          // Tentar carregar do localStorage uma última vez
          try {
            const quizData = JSON.parse(finalCheck);
            if (quizData.about_who && quizData.style) {
              logger.debug('✅ [Checkout] Carregando quiz do localStorage na última tentativa');
              setQuiz(quizData);
              setLoading(false);
              return;
            }
          } catch (error) {
            logger.error('❌ [Checkout] Erro ao carregar quiz na última tentativa:', error);
          }
        }
        return;
      }
      
      if (!loading && !quiz && !isRedirectingRef.current) {
        const quizPath = getQuizPath();
        logger.debug('❌ [Checkout] Quiz não carregado após todas as tentativas, redirecionando para quiz', { quizPath });
        logger.debug('📋 [Checkout] Estado atual:', { 
          loading, 
          hasQuiz: !!quiz, 
          hasEmail: !!email,
          hasLocalStorage: !!localStorage.getItem('pending_quiz'),
          hasSessionStorage: !!sessionStorage.getItem('pending_quiz'),
          hasProcessed: hasProcessedRef.current
        });
        isRedirectingRef.current = true;
        navigateWithUtms(quizPath);
      }
    }, 3000); // ✅ Aumentar para 3000ms para dar mais tempo aos retries e atualização de estado
    
    return () => clearTimeout(redirectTimeout);
  }, [loading, quiz, navigateWithUtms, email]);

  if (isRedirecting) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Redirecionando para pagamento...</p>
      </div>
    );
  }

  if (loading) {
    logger.debug('⏳ Checkout em loading state');
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedPlanData = plans.find(p => p.id === selectedPlan)!;

  // Verificar se quiz está carregado durante o render
  if (!loading && !quiz) {
    // Mostrar loading enquanto tenta carregar ou redirecionar
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  logger.debug('✅ Checkout renderizando com quiz', { hasQuiz: !!quiz, aboutWho: quiz?.about_who });

  return (
    <div className="min-h-[100dvh] bg-background checkout-mobile-compact">
      <div className="container mx-auto px-4 py-4 md:px-6 md:py-10 max-w-[1400px] pb-28 md:pb-8" style={{ paddingTop: '0px', marginTop: 0 }}>
        <div className="text-center mb-6 md:mb-8">
          <p className="text-2xl md:text-2xl lg:text-3xl mb-2 md:mb-3">
            <strong>{t('checkout.subtitle')}</strong> <strong className="text-muted-foreground text-2xl md:text-3xl lg:text-3xl">{quiz?.about_who}</strong>.
          </p>
          <h1 className="text-xl md:text-xl lg:text-2xl mb-4 md:mb-5">{t('checkout.title')}</h1>
          
        </div>


        <div className="grid lg:grid-cols-[1fr,500px] gap-4 md:gap-8">
          {/* Mobile-First: Payment Card First (order-1 on mobile, order-2 on desktop) */}
          <div className="order-1 lg:order-2 space-y-2 md:space-y-4" style={{ minHeight: '400px' }}>
            <Card className="compact-card">
              <CardHeader className="pb-3 md:pb-3">
                <CardTitle className="text-xl md:text-xl lg:text-2xl font-bold">{t('checkout.completeOrder')}</CardTitle>
                <CardDescription className="text-base md:text-base hidden md:block mt-2">
                  {t('checkout.emailDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-4 p-4 md:p-6">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder={t('checkout.emailPlaceholder')}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    onBlur={validateEmail}
                    className={`text-lg md:text-lg py-4 ${emailError ? 'border-destructive' : ''}`}
                    disabled={processing}
                  />
                  {emailError && (
                    <p className="text-sm text-destructive">{emailError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base md:text-base font-medium pointer-events-none">
                      +55
                    </span>
                    <Input
                      type="tel"
                      placeholder={t('checkout.whatsappPlaceholder') || '(11) 99999-9999'}
                      value={whatsapp}
                      onChange={(e) => {
                        setWhatsapp(e.target.value);
                      }}
                      onBlur={validateWhatsApp}
                      className={`pl-14 text-lg md:text-lg py-4 ${whatsappError ? 'border-destructive' : ''}`}
                      disabled={processing}
                    />
                  </div>
                  {whatsappError && (
                    <p className="text-sm text-destructive">{whatsappError}</p>
                  )}
                </div>

                {/* ✅ Botão acima dos planos (mobile only) */}
                <Button
                  onClick={() => handleCheckout(false)}
                  disabled={processing}
                  className={`w-full btn-pulse h-16 md:h-12 font-bold text-lg md:text-lg lg:text-xl ${
                    buttonError
                      ? 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 animate-pulse'
                      : cameFromRestore && email && whatsapp && !whatsappError
                      ? 'bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 animate-pulse'
                      : 'bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800 hover:from-emerald-800 hover:via-green-800 hover:to-emerald-900'
                  } text-white shadow-lg ${buttonError ? 'shadow-red-800/40' : 'shadow-emerald-800/40'} hover:scale-105 transition-transform disabled:opacity-100 disabled:cursor-not-allowed md:hidden`}
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {retryCount > 0 ? `${t('checkout.trying')} (${retryCount}/2)` : t('checkout.processing')}
                    </>
                  ) : buttonError ? (
                    <>
                      <X className="mr-2 h-5 w-5" />
                      {!email && !whatsapp ? 'Preencha os campos acima' : !email ? 'Preencha o email' : 'Preencha o WhatsApp'}
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 h-5 w-5" />
                      {cameFromRestore && email && whatsapp ? '🚀 Pagar Agora' : t('checkout.createMyMusic')}
                    </>
                  )}
                </Button>

                {/* ✅ Planos sem card wrapper (mobile only) */}
                <div className="md:hidden mt-3 space-y-1.5">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPlan === plan.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-0.5">
                            <h3 className="font-semibold text-xs">{plan.name}</h3>
                            {plan.featured && (
                              <Badge variant="default" className="text-[10px] badge-pulse font-bold">
                                {t('checkout.mostPopular')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('checkout.deliveryIn')} {plan.delivery}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-primary">
                            R$ {(plan.price / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <ul className="space-y-0.5 mt-1">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Check className="h-2.5 w-2.5 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {selectedPlan === plan.id && (
                        <div className="mt-1 flex items-center gap-0.5 text-[10px] text-primary">
                          <Check className="h-2.5 w-2.5" />
                          {t('checkout.selected')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ✅ Botão para desktop */}
                <div className="hidden md:block mt-4">
                  <Button
                    onClick={() => handleCheckout(false)}
                    disabled={processing}
                    className={`w-full btn-pulse h-12 font-bold text-lg lg:text-xl ${
                      buttonError
                        ? 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 animate-pulse'
                        : cameFromRestore && email && whatsapp && !whatsappError
                        ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 animate-pulse'
                        : 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700'
                    } text-white shadow-lg ${buttonError ? 'shadow-red-800/40' : 'shadow-emerald-500/40'} hover:scale-105 transition-transform disabled:opacity-100 disabled:cursor-not-allowed`}
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {retryCount > 0 ? `${t('checkout.trying')} (${retryCount}/2)` : t('checkout.processing')}
                      </>
                    ) : buttonError ? (
                      <>
                        <X className="mr-2 h-5 w-5" />
                        {!email && !whatsapp ? 'Preencha os campos acima' : !email ? 'Preencha o email' : 'Preencha o WhatsApp'}
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-5 w-5" />
                        {cameFromRestore && email && whatsapp ? '🚀 Pagar Agora' : t('checkout.createMyMusic')}
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-sm md:text-sm">
                    <Check className="mr-1 h-4 w-4" />
                    {t('checkout.guarantee30Days')}
                  </Badge>
                </div>

                <p className="text-sm md:text-sm text-center text-muted-foreground">
                  {t('checkout.securePayment')}
                </p>
              </CardContent>
            </Card>

            {/* Compact Plan Summary */}
            <Card className="compact-card">
              <CardContent className="pt-4 md:pt-5 p-4 md:p-6 space-y-3 md:space-y-3">
                <div className="flex items-center justify-between text-base md:text-base">
                  <span className="text-muted-foreground">{t('checkout.musicFor')}</span>
                  <strong className="text-base md:text-base">{quiz?.about_who}</strong>
                </div>
                <div className="flex items-center justify-between text-base md:text-base">
                  <span className="text-muted-foreground">{t('checkout.style')}</span>
                  <strong className="text-base md:text-base">{quiz?.style}</strong>
                </div>
                <div className="flex items-center justify-between text-base md:text-base">
                  <span className="text-muted-foreground">{t('checkout.delivery')}</span>
                  <strong className="text-base md:text-base text-orange-600">{t('checkout.delivery24h')}</strong>
                </div>
                
                {/* Copy 2 Versões */}
                <div className="mt-3 md:mt-3 p-2 md:p-2 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-base md:text-base">🎁</span>
                    <span className="font-bold text-sm md:text-sm">{t('checkout.twoVersionsBenefit')}</span>
                  </div>
                </div>
                
                <div className="border-t pt-3 md:pt-3 mt-3 md:mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base md:text-base font-medium">{t('checkout.total')}</span>
                    <div className="flex items-baseline gap-2 md:gap-2">
                      <span className="text-base md:text-base text-muted-foreground line-through">
                        R$ {(selectedPlanData.price / 100 * 3.3).toFixed(2)}
                      </span>
                      <span className="text-2xl md:text-2xl font-bold text-primary">
                        R$ {(selectedPlanData.price / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop: Details on Left (order-2 on mobile, order-1 on desktop) */}
          <div className="order-2 lg:order-1 space-y-2 md:space-y-4">
            {/* Your Custom Song Order */}
            <Card className="compact-card hidden md:block">
              <CardHeader className="pb-3 md:pb-3">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-xl font-bold">
                  <Music className="h-5 w-5 md:h-5 md:w-5 text-primary" />
                  {t('checkout.customSongOrder')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 md:p-6">
                <div className="space-y-3 md:space-y-3">
                  <div className="flex items-center justify-between text-base md:text-base">
                    <span className="text-muted-foreground">{t('checkout.musicFor')}</span>
                    <span className="font-medium">{quiz?.about_who}</span>
                  </div>
                  <div className="flex items-center justify-between text-base md:text-base">
                    <span className="text-muted-foreground">{t('checkout.delivery')}</span>
                    <span className="font-medium">
                      {selectedPlan === 'express' ? t('checkout.deliveryIn48h') : t('checkout.deliveryIn7Days')}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4 md:pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base md:text-base font-medium">{t('checkout.personalizedMusic')}</span>
                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-sm md:text-sm">
                        {t('checkout.discount70')}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base md:text-base text-muted-foreground line-through">
                        R$ {(selectedPlanData.price / 100 * 3.3).toFixed(2)}
                      </span>
                      <span className="text-2xl md:text-2xl font-bold text-primary">
                        R$ {(selectedPlanData.price / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full text-base md:text-base py-5"
                  onClick={() => navigateWithUtms(getQuizPath())}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t('checkout.reviewQuestionnaire')}
                </Button>
              </CardContent>
            </Card>

            {/* Plan Selection - Desktop */}
            <Card className="compact-card hidden md:block">
              <CardHeader className="pb-3 md:pb-3">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-xl font-bold">
                  {currentLanguage === 'pt' ? t('checkout.expressPlan') : t('checkout.choosePlan')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-3 p-4 md:p-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-4 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPlan === plan.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <div className="flex items-start justify-between mb-2 md:mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 md:gap-2 mb-1 md:mb-1">
                          <h3 className="font-semibold text-base md:text-base lg:text-lg">{plan.name}</h3>
                          {plan.featured && (
                            <Badge variant="default" className="text-xs md:text-xs badge-pulse font-bold">
                              {t('checkout.mostPopular')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm md:text-sm text-muted-foreground">
                          {t('checkout.deliveryIn')} {plan.delivery}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl md:text-xl lg:text-2xl font-bold text-primary">
                          {plan.currency === 'BRL' ? 'R$' : '$'} {(plan.price / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                      <ul className="space-y-1 md:space-y-1 mt-2 md:mt-3">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-sm md:text-sm text-muted-foreground flex items-center gap-1 md:gap-1.5">
                          <Check className="h-4 w-4 md:h-4 md:w-4 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {selectedPlan === plan.id && (
                      <div className="mt-2 md:mt-3 flex items-center gap-1 md:gap-1.5 text-sm md:text-sm text-primary font-semibold">
                        <Check className="h-4 w-4 md:h-4 md:w-4" />
                        {t('checkout.selected')}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Limited Time Discount */}
            <Card className="compact-card border-orange-200 bg-orange-50 hidden md:block">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-sm">
                  <Gift className="h-4 w-4 md:h-4 md:w-4 text-orange-600" />
                  <span className="text-orange-900">{t('checkout.limitedTimeDiscount')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-xs space-y-2 p-4 md:p-4">
                <p className="text-orange-900">
                  {t('checkout.normalPrice')} <strong>R$ 299</strong>, {t('checkout.butWeBelieve')}{' '}
                  <strong>R$ {(selectedPlanData.price / 100).toFixed(2)}</strong> {t('checkout.forLimitedTime')}.
                </p>
                <p className="text-orange-900 font-semibold">
                  Música com Qualidade de studio HD
                </p>
                <p className="text-orange-900">
                  <strong>{t('checkout.whyOnly')} R$ {(selectedPlanData.price / 100).toFixed(2)}?</strong> {t('checkout.weArePassionate')}.
                </p>
              </CardContent>
            </Card>

            {/* Hear Other Songs We Made */}
            <Card className="compact-card hidden md:block">
              <CardHeader className="pb-2 md:pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-sm">
                  <Music className="h-4 w-4 md:h-4 md:w-4 text-primary" />
                  {t('checkout.hearOtherSongs')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 md:p-4">
                {[
                  { title: 'Lá na Escola', orderedBy: 'Ana Paula M.' },
                  { title: 'Pop Feliz', orderedBy: 'Ricardo S.' }
                ].map((song, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <button 
                      onClick={() => togglePlay(idx)}
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      {currentlyPlaying === idx ? (
                        <Pause className="h-4 w-4 text-primary fill-primary" />
                      ) : (
                        <Play className="h-4 w-4 text-primary fill-primary ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">{t('checkout.orderedBy')} {song.orderedBy}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(currentTimes[idx])} / {formatTime(durations[idx])}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 100% Money Back Guarantee */}
            <Card className="compact-card border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                  <span className="text-green-900">{t('checkout.moneyBackGuarantee')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 md:p-6">
                {[
                  { title: t('checkout.notSatisfied'), subtitle: t('checkout.noQuestions') },
                  { title: t('checkout.guarantee30DaysFull'), subtitle: t('checkout.timeToDecide') },
                  { title: t('checkout.riskFreePurchase'), subtitle: t('checkout.satisfactionPriority') }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">{item.title}</p>
                      <p className="text-xs text-green-700">{item.subtitle}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* What You'll Get */}
            <Card className="compact-card">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Gift className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  {t('checkout.whatYouWillReceive')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 md:p-6">
                {[
                  { title: t('checkout.radioQuality'), subtitle: t('checkout.radioQualitySubtitle') },
                  { title: t('checkout.personalizedLyrics'), subtitle: t('checkout.writtenFor') + ' ' + quiz?.about_who },
                  { title: selectedPlan === 'express' ? t('checkout.delivery24hTitle') : t('checkout.delivery7DaysTitle'), subtitle: t('checkout.perfectForLastMinute') }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Why Choose MusicLovely */}
            <Card className="compact-card">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  {t('checkout.whyChooseMusicLovely')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 md:p-6">
                {[
                  t('checkout.over1000Clients'),
                  t('checkout.satisfactionGuarantee'),
                  t('checkout.securePaymentProcessing'),
                  t('checkout.deliveredIn7Days')
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* ✅ Botão fixo na parte inferior (mobile only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-sm border-t border-border shadow-2xl">
        <Button
          onClick={() => handleCheckout(false)}
          disabled={processing}
          className={`w-full btn-pulse h-14 font-bold text-base ${
            buttonError
              ? 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 animate-pulse'
              : 'bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800 hover:from-emerald-800 hover:via-green-800 hover:to-emerald-900'
          } text-white shadow-lg ${buttonError ? 'shadow-red-800/40' : 'shadow-emerald-800/40'} hover:scale-105 transition-transform disabled:opacity-100 disabled:cursor-not-allowed`}
          size="lg"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {retryCount > 0 ? `${t('checkout.trying')} (${retryCount}/2)` : t('checkout.processing')}
            </>
          ) : buttonError ? (
            <>
              <X className="mr-2 h-5 w-5" />
              {!email && !whatsapp ? 'Preencha os campos acima' : !email ? 'Preencha o email' : 'Preencha o WhatsApp'}
            </>
          ) : (
            <>
              <Gift className="mr-2 h-5 w-5" />
              {t('checkout.createMyMusic')}
            </>
          )}
        </Button>
      </div>
      
      
    </div>
  );
}
