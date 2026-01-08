import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { apiHelpers } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Gift, Music, Edit, Play, Pause, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ✅ OTIMIZAÇÃO: Usar URLs estáticas em vez de imports (evita incluir no bundle)
const laNaEscolaAudio = '/audio/la_na_escola-2.mp3';
const popFelizAudio = '/audio/pop_feliz.mp3';
import { toast } from 'sonner';
import { ZodError } from 'zod';
import { createCheckoutLogger } from '@/lib/checkout-logger';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cleanupOrphanOrders } from '@/lib/cleanup-orphan-orders';
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

export default function Checkout() {
  logger.debug('Checkout component mounted');
  
  // ⚠️ CRÍTICO: Verificação IMEDIATA antes de qualquer processamento
  // Se a URL contém message_id (veio do WhatsApp), redirecionar IMEDIATAMENTE para Cakto
  // Isso deve acontecer ANTES de qualquer lógica do componente
  const urlParams = new URLSearchParams(window.location.search);
  const messageId = urlParams.get('message_id');
  const orderId = urlParams.get('order_id');
  
  // ⚠️ REDIRECIONAMENTO IMEDIATO: Se tem message_id, redirecionar ANTES de processar qualquer coisa
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  useEffect(() => {
    if (messageId && orderId && !window.location.href.includes('pay.cakto.com.br') && !isRedirecting) {
      logger.debug('REDIRECIONAMENTO IMEDIATO: URL do WhatsApp detectada (tem message_id), redirecionando para Cakto ANTES de processar...');
      setIsRedirecting(true);
      
      // Buscar pedido e redirecionar IMEDIATAMENTE
      supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
        .then(({ data: orderData, error }) => {
          if (!error && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            const caktoConfig = getCaktoConfig();
            const CAKTO_PAYMENT_URL = caktoConfig.url;
            // ✅ CORREÇÃO: Normalizar WhatsApp e garantir prefixo 55
            let normalizedWhatsapp = orderData.customer_whatsapp.replace(/\D/g, '');
            if (!normalizedWhatsapp.startsWith('55')) {
              normalizedWhatsapp = `55${normalizedWhatsapp}`;
            }
            const origin = window.location.origin;
            const redirectUrl = `${origin}/payment-success`;
            
            const caktoParams = new URLSearchParams();
            caktoParams.set('order_id', orderData.id);
            caktoParams.set('email', orderData.customer_email);
            // ✅ Cakto usa 'phone' para pré-preencher o telefone (não 'whatsapp')
            caktoParams.set('phone', normalizedWhatsapp);
            caktoParams.set('language', 'pt');
            caktoParams.set('redirect_url', redirectUrl);
            
            const caktoUrl = `${CAKTO_PAYMENT_URL}?${caktoParams.toString()}`;
            logger.debug('Redirecionando IMEDIATAMENTE para Cakto', { caktoUrl: caktoUrl.substring(0, 100) });
            // ⚠️ CRÍTICO: Usar window.location.replace para evitar que o React Router intercepte
            window.location.replace(caktoUrl);
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
    const language = getCurrentLanguage();
    return `/${language}/quiz`;
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
    const caktoConfig = getCaktoConfigByDomain();
    const CAKTO_PAYMENT_URL = caktoConfig.url;
    const origin = window.location.origin;
    const utmQuery = getUtmQueryString(false);
    // ✅ CORREÇÃO: Padronizar redirect_url para /payment-success (sem barra antes de success)
    const redirectUrl = `${origin}/${language}/payment-success?order_id=${orderId}${utmQuery}`;
    
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
      console.warn('⚠️ [generateCaktoUrl] WhatsApp inválido ou vazio, URL será gerada sem phone', {
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
      
      logger.debug('redirectToCakto: Redirecionando para Cakto', {
        orderId: orderData.id,
        email: orderData.customer_email,
        whatsapp: orderData.customer_whatsapp,
        urlLength: caktoUrl.length,
        urlPreview: caktoUrl.substring(0, 100) + '...'
      });

      // Redirecionar
      setTimeout(() => {
        logger.debug('redirectToCakto: Executando redirecionamento agora');
        window.location.href = caktoUrl;
      }, 100);
      
      return true;
    } catch (error) {
      logger.error('redirectToCakto: Erro ao redirecionar', error);
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
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [buttonError, setButtonError] = useState(false);
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
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
  // Lazy loading: criar elementos de áudio apenas quando necessário
  const audioElementsRef = React.useRef<{ [key: number]: HTMLAudioElement | null }>({ 0: null, 1: null });
  const [currentTimes, setCurrentTimes] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });
  const [durations, setDurations] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });
  
  // Função para obter ou criar elemento de áudio sob demanda
  const getAudioElement = (index: number): HTMLAudioElement | null => {
    if (!audioElementsRef.current[index]) {
      // Criar apenas quando necessário
      const audioSrc = index === 0 ? laNaEscolaAudio : popFelizAudio;
      const audio = new Audio(audioSrc);
      audio.preload = 'none';
      audioElementsRef.current[index] = audio;
    }
    return audioElementsRef.current[index];
  };

  // ⚠️ NOTA: Scripts UTMify são carregados globalmente no index.html
  // Não é necessário carregar novamente aqui para evitar duplicação
  // Os scripts já estão configurados no <head> do index.html

  // FASE 2 & 3: Carregar quiz do banco (se vier da URL) ou do localStorage
  useEffect(() => {
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
      
      // ⚠️ CRÍTICO: Se a URL contém message_id (veio do WhatsApp), redirecionar IMEDIATAMENTE para Cakto
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
            logger.debug('Pedido encontrado, redirecionando para Cakto...');
            const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
            if (redirectSuccess) {
              return; // Redirecionamento bem-sucedido, sair da função
            }
          }
        } catch (redirectError) {
          logger.error('Erro ao redirecionar para Cakto', redirectError);
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
          if (!quizData.about_who || !quizData.style) {
            logger.error('Quiz incompleto', {
              hasAboutWho: !!quizData.about_who,
              hasStyle: !!quizData.style,
              quizData
            });
            toast.error('Quiz incompleto. Por favor, preencha o quiz novamente.');
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
            console.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
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
          logger.debug('URL do WhatsApp detectada com restore=true, redirecionando para Cakto...');
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
              logger.debug('Pedido encontrado, redirecionando para Cakto...');
              const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
              if (redirectSuccess) {
                return; // Redirecionamento bem-sucedido, sair da função
              }
            }
          } catch (redirectError) {
            logger.error('Erro ao redirecionar para Cakto', redirectError);
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
              logger.warn('Quiz não encontrado, mas pedido tem dados. Tentando redirecionar para Cakto mesmo assim...', {
                orderId: orderData.id,
                status: orderData.status,
                email: orderData.customer_email,
                whatsapp: orderData.customer_whatsapp,
                currentPath: window.location.pathname
              });
              
              // SEMPRE tentar redirecionar se auto=true e pedido tem dados, independente da rota
              const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
              
              if (redirectSuccess) {
                logger.debug('Redirecionamento para Cakto iniciado com sucesso');
                return; // Não continuar o fluxo
              } else {
                logger.error('Falha ao redirecionar para Cakto');
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
              // ✅ Tudo OK - redirecionar direto para Cakto
              // SEMPRE redirecionar se auto=true e pedido tem dados, independente da rota
              logger.debug('Quiz encontrado e pedido válido, redirecionando para Cakto...');
              const redirectSuccess = await redirectToCakto(
                orderData, 
                utms || {}, 
                quizData.language || 'pt'
              );
              
              if (redirectSuccess) {
                logger.debug('Redirecionamento para Cakto iniciado com sucesso');
                return; // Não continuar o fluxo
              } else {
                logger.error('Falha ao redirecionar para Cakto, restaurando quiz...');
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
      
      // ✅ PRIORIDADE 0: Se restore=true, verificar se deve redirecionar para Cakto primeiro
      // ⚠️ CRÍTICO: Se a URL contém message_id (veio do WhatsApp), redirecionar para Cakto ao invés de processar checkout interno
      if (restore === 'true' && orderId && quizId) {
        const messageIdFromUrl = urlParams.get('message_id');
        // Se tem message_id, significa que veio do WhatsApp e deve ir direto para Cakto
        if (messageIdFromUrl && !window.location.href.includes('pay.cakto.com.br')) {
          logger.debug('URL do WhatsApp detectada (tem message_id), redirecionando para Cakto...');
          setLoading(true);
          
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single();
            
            if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.debug('Pedido encontrado, redirecionando para Cakto...');
              const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
              if (redirectSuccess) {
                return; // Redirecionamento bem-sucedido, sair da função
              }
            }
          } catch (redirectError) {
            logger.error('Erro ao redirecionar para Cakto', redirectError);
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
            
            // Se tem orderData mas não tem quiz, tentar redirecionar para Cakto mesmo assim
            // Se auto=true, SEMPRE tentar redirecionar independente da rota
            if (!orderError && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
              logger.warn('Quiz não encontrado no restore, mas pedido tem dados. Tentando redirecionar para Cakto...', { auto, orderId });
              
              // Se auto=true, sempre tentar redirecionar
              if (auto === 'true') {
                logger.debug('auto=true detectado, redirecionando para Cakto...');
                const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
                
                if (redirectSuccess) {
                  logger.debug('Redirecionamento para Cakto iniciado com sucesso');
                  return;
                } else {
                  logger.error('Falha ao redirecionar para Cakto');
                }
              } else {
                logger.debug('auto não é true, não redirecionando automaticamente');
              }
            }
            
            toast.error(`Erro ao carregar quiz: ${quizError?.message || 'Quiz não encontrado'}`);
            setLoading(false);
            // Continuar com fluxo normal - não retornar para tentar localStorage
          } else if (orderError || !orderData) {
            console.error('❌ [Checkout] Erro ao buscar pedido no restore:', orderError);
            console.error('❌ [Checkout] Detalhes:', {
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
              console.error('❌ [Checkout] Quiz não pertence ao pedido:', {
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
              
              console.log('✅ [Checkout] Quiz restaurado do banco com sucesso:', {
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
          console.error('❌ [Checkout] Erro ao restaurar quiz:', error);
          
          // Se auto=true, tentar redirecionar para Cakto mesmo com erro
          if (auto === 'true' && orderId) {
            console.log('⚠️ [Checkout] Erro no restore, mas auto=true. Tentando buscar pedido e redirecionar...');
            try {
              const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();
              
              if (orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
                console.log('✅ [Checkout] Pedido encontrado no fallback, redirecionando para Cakto...');
                const redirectSuccess = await redirectToCakto(orderData, utms || {}, 'pt');
                
                if (redirectSuccess) {
                  console.log('✅ [Checkout] Redirecionamento para Cakto iniciado com sucesso após erro');
                  return;
                } else {
                  console.error('❌ [Checkout] Falha ao redirecionar para Cakto no fallback');
                }
              } else {
                console.warn('⚠️ [Checkout] Pedido não tem dados necessários no fallback:', {
                  hasOrderData: !!orderData,
                  status: orderData?.status,
                  hasEmail: !!orderData?.customer_email,
                  hasWhatsapp: !!orderData?.customer_whatsapp
                });
              }
          } catch (fallbackError) {
            console.error('❌ [Checkout] Erro no fallback:', fallbackError);
          }
        }
        
        // ✅ Só exibir erro se realmente não houver quiz no localStorage ou sessionStorage
        const hasLocalQuiz = localStorage.getItem('pending_quiz');
        const hasSessionQuiz = sessionStorage.getItem('pending_quiz');
        
        if (!hasLocalQuiz && !hasSessionQuiz) {
          console.error('❌ [Checkout] Erro ao restaurar quiz e não há quiz no localStorage/sessionStorage');
          toast.error(t('checkout.errors.errorLoadingQuiz'));
        } else {
          console.log('✅ [Checkout] Erro ao restaurar quiz, mas há quiz no localStorage/sessionStorage, continuando...');
        }
        // Continuar com fluxo normal para tentar carregar do localStorage
      }
    }
      
      // ✅ Se chegou aqui, não processou localStorage acima (ou restore=true ou não havia quiz)
      // Verificar localStorage novamente (pode ter sido adicionado durante o processamento)
      // ✅ Reutilizar variáveis já declaradas no início da função
      pendingQuiz = localStorage.getItem('pending_quiz');
      savedDraft = localStorage.getItem(draftKey);
    
      console.log('📋 [Checkout] Dados encontrados no localStorage:', {
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
          console.log('✅ [Checkout] Quiz data parseado com sucesso:', {
            hasAboutWho: !!quizData.about_who,
            hasStyle: !!quizData.style,
            hasLanguage: !!quizData.language,
            hasId: !!quizData.id,
            quizData
          });
          
          // Validar que o quiz tem dados mínimos necessários
          if (!quizData.about_who || !quizData.style) {
            console.error('❌ [Checkout] Quiz incompleto:', {
              hasAboutWho: !!quizData.about_who,
              hasStyle: !!quizData.style,
              quizData
            });
            toast.error('Quiz incompleto. Por favor, preencha o quiz novamente.');
            // ✅ NÃO limpar quiz imediatamente - manter para debug
            // localStorage.removeItem('pending_quiz'); // Comentado para debug
            console.warn('⚠️ [Checkout] Quiz incompleto mantido no localStorage para debug');
            const quizPath = getQuizPath();
            console.log('🔄 [Checkout] Redirecionando para quiz (quiz incompleto):', quizPath);
            navigateWithUtms(quizPath);
            return;
          }
          
          // Se existe draft, limpar para não interferir
          if (savedDraft) {
            console.log('🗑️ [Checkout] Limpando draft antigo para usar novo quiz');
            localStorage.removeItem(draftKey);
          }
          
          setQuiz(quizData);
          setShouldRedirect(false); // Resetar flag de redirecionamento
          setLoading(false);
          console.log('✅ [Checkout] Quiz carregado do localStorage');
          
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
            console.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
          }
          
          return;
        } catch (error) {
          console.error('❌ [Checkout] Error parsing quiz data:', {
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
              console.error('❌ [Checkout] Análise do JSON inválido:', {
                firstChar,
                lastChar,
                startsWithBrace: firstChar === '{',
                endsWithBrace: lastChar === '}',
                length: pendingQuiz.length
              });
            } catch (analysisError) {
              console.error('❌ [Checkout] Erro ao analisar JSON:', analysisError);
            }
          }
          
          // ✅ Tentar verificar se há quiz válido no sessionStorage como fallback (silencioso)
          const sessionQuiz = sessionStorage.getItem('pending_quiz');
          if (sessionQuiz) {
            try {
              const sessionQuizData = JSON.parse(sessionQuiz);
              if (sessionQuizData.about_who && sessionQuizData.style) {
                console.log('✅ [Checkout] Quiz encontrado no sessionStorage, restaurando silenciosamente...');
                // Restaurar do sessionStorage para localStorage (sem toast)
                localStorage.setItem('pending_quiz', sessionQuiz);
                setQuiz(sessionQuizData);
                setShouldRedirect(false);
                setLoading(false);
                // Não mostrar toast - fluxo silencioso
                return;
              }
            } catch (sessionError) {
              console.error('❌ [Checkout] Erro ao restaurar do sessionStorage:', sessionError);
            }
          }
          
          toast.error(t('checkout.errors.errorLoadingQuiz'));
          // ✅ NÃO limpar quiz imediatamente - manter para debug
          // localStorage.removeItem('pending_quiz'); // Comentado para debug
          console.warn('⚠️ [Checkout] Quiz inválido mantido no localStorage para debug');
          
          // Aguardar um pouco antes de redirecionar para dar chance de ver o erro
          setTimeout(() => {
            const quizPath = getQuizPath();
            console.log('🔄 [Checkout] Redirecionando para quiz com caminho completo:', quizPath);
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
      console.log('✅ [Checkout] Parâmetros da URL detectados:', { urlEmail: !!urlEmail, urlWhatsapp: !!urlWhatsapp });
      if (urlEmail) {
        setEmail(urlEmail);
        console.log('✅ [Checkout] Email pré-preenchido da URL:', urlEmail);
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
          console.log('✅ [Checkout] WhatsApp pré-preenchido da URL:', formatted);
        } else {
          setWhatsapp(urlWhatsapp);
          console.log('✅ [Checkout] WhatsApp pré-preenchido da URL (sem formatação):', urlWhatsapp);
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
          console.log('✅ Draft carregado, loading set to false');
          
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
            console.warn('⚠️ [Checkout] Erro ao rastrear evento:', trackError);
          }
          
          toast.info(t('checkout.errors.orderRecovered'));
          return;
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
    
    // Sem quiz e sem draft: verificar sessionStorage como fallback
    console.error('❌ [Checkout] Nenhum quiz ou draft encontrado no localStorage', {
      hasPendingQuiz: !!pendingQuiz,
      hasSavedDraft: !!savedDraft,
      localStorageKeys: Object.keys(localStorage).filter(k => k.includes('quiz') || k.includes('draft')),
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
    
    // ✅ FALLBACK: Tentar buscar do sessionStorage (silencioso)
    const sessionQuiz = sessionStorage.getItem('pending_quiz');
    if (sessionQuiz) {
      console.log('✅ [Checkout] Quiz encontrado no sessionStorage, restaurando silenciosamente...');
      try {
        const sessionQuizData = JSON.parse(sessionQuiz);
        if (sessionQuizData.about_who && sessionQuizData.style) {
          // Restaurar do sessionStorage para localStorage (sem toast)
          localStorage.setItem('pending_quiz', sessionQuiz);
          setQuiz(sessionQuizData);
          setShouldRedirect(false);
          setLoading(false);
          // Não mostrar toast - fluxo silencioso como antes
          console.log('✅ [Checkout] Quiz restaurado do sessionStorage com sucesso');
          return;
        } else {
          console.warn('⚠️ [Checkout] Quiz do sessionStorage está incompleto');
        }
      } catch (error) {
        console.error('❌ [Checkout] Erro ao restaurar do sessionStorage:', error);
      }
    }
    
    setLoading(false); // Importante: setar loading como false antes de redirecionar
    
    // ✅ Consolidar mensagens de erro - mostrar apenas uma
    if (!toastShownRef.current) {
      toast.error(t('checkout.errors.quizNotFound'));
      toastShownRef.current = true;
    }
    
    // Usar requestAnimationFrame para evitar problemas de CSP
    requestAnimationFrame(() => {
      if (!isRedirectingRef.current) {
        const quizPath = getQuizPath();
        console.log('🔄 [Checkout] Executando redirecionamento para quiz com caminho completo:', quizPath);
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
      console.log('🔄 [Checkout] Retry 1 (200ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz && !quiz) {
        console.warn('⚠️ [Checkout] Retry 1: Quiz ainda não encontrado após 200ms');
        // Continuar para próximo retry
      } else if (retryPendingQuiz && !quiz) {
        console.log('✅ [Checkout] Retry 1: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            console.log('✅ [Checkout] Quiz carregado no retry 1');
            return; // Sucesso, não precisa mais retries
          } else {
            console.warn('⚠️ [Checkout] Retry 1: Quiz encontrado mas incompleto');
          }
        } catch (retryError) {
          console.error('❌ [Checkout] Erro no retry 1:', retryError);
        }
      }
    }, 100);
    retryTimeouts.push(retry1);
    
    // Retry 2: após 500ms (total 500ms)
    const retry2 = setTimeout(() => {
      if (quiz) {
        console.log('✅ [Checkout] Retry 2: Quiz já carregado, cancelando retry');
        return; // Quiz já foi carregado
      }
      
      const retryPendingQuiz = localStorage.getItem('pending_quiz');
      console.log('🔄 [Checkout] Retry 2 (500ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz) {
        console.warn('⚠️ [Checkout] Retry 2: Quiz ainda não encontrado após 500ms');
        // Continuar para próximo retry
      } else {
        console.log('✅ [Checkout] Retry 2: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            console.log('✅ [Checkout] Quiz carregado no retry 2');
            return; // Sucesso
          } else {
            console.warn('⚠️ [Checkout] Retry 2: Quiz encontrado mas incompleto:', {
              hasAboutWho: !!retryQuizData.about_who,
              hasStyle: !!retryQuizData.style
            });
          }
        } catch (retryError) {
          console.error('❌ [Checkout] Erro no retry 2:', {
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
        console.log('✅ [Checkout] Retry 3: Quiz já carregado, cancelando retry');
        return; // Quiz já foi carregado
      }
      
      const retryPendingQuiz = localStorage.getItem('pending_quiz');
      console.log('🔄 [Checkout] Retry 3 (1000ms): Verificando localStorage...', {
        hasPendingQuiz: !!retryPendingQuiz,
        hasQuiz: !!quiz,
        timestamp: new Date().toISOString()
      });
      
      if (!retryPendingQuiz) {
        console.error('❌ [Checkout] Retry 3: Quiz ainda não encontrado após 1 segundo');
        console.error('❌ [Checkout] Todos os retries falharam. Verificando localStorage completo:', {
          allKeys: Object.keys(localStorage),
          pendingQuizKeys: Object.keys(localStorage).filter(k => k.includes('quiz') || k.includes('draft')),
          timestamp: new Date().toISOString()
        });
        // Não redirecionar aqui, deixar o processLocalStorage acima tratar
      } else {
        console.log('✅ [Checkout] Retry 3: Quiz encontrado, carregando...');
        try {
          const retryQuizData = JSON.parse(retryPendingQuiz);
          if (retryQuizData.about_who && retryQuizData.style) {
            setQuiz(retryQuizData);
            setShouldRedirect(false);
            setLoading(false);
            console.log('✅ [Checkout] Quiz carregado no retry 3 (última tentativa)');
          } else {
            console.error('❌ [Checkout] Retry 3: Quiz encontrado mas incompleto:', {
              hasAboutWho: !!retryQuizData.about_who,
              hasStyle: !!retryQuizData.style,
              retryQuizData
            });
          }
        } catch (retryError) {
          console.error('❌ [Checkout] Erro no retry 3 (última tentativa):', {
            error: retryError instanceof Error ? retryError.message : String(retryError),
            errorStack: retryError instanceof Error ? retryError.stack : undefined,
            pendingQuizRaw: retryPendingQuiz?.substring(0, 200)
          });
        }
      }
    }, 1000);
    retryTimeouts.push(retry3);
    
    return () => {
      retryTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []); // ✅ Executar apenas uma vez ao montar o componente


  // Limpar elementos de áudio quando componente desmontar
  useEffect(() => {
    return () => {
      // Limpar todos os elementos de áudio ao desmontar
      Object.values(audioElementsRef.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
          audio.load();
        }
      });
      audioElementsRef.current = { 0: null, 1: null };
    };
  }, []);

  const validateEmail = () => {
    setEmailError('');
    try {
      emailSchema.parse(email);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        setEmailError(error.errors[0].message);
      }
      return false;
    }
  };

  // Função para formatar WhatsApp com máscara visual
  const formatWhatsApp = (value: string): string => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + número)
    const limitedNumbers = numbers.slice(0, 11);
    
    // Aplica máscara: (XX) XXXXX-XXXX
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7, 11)}`;
    }
  };

  // Função para validar WhatsApp
  const validateWhatsApp = (): boolean => {
    setWhatsappError('');
    try {
      whatsappSchema.parse(whatsapp);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        setWhatsappError(error.errors[0].message);
      }
      return false;
    }
  };

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
      console.error('Error saving draft:', error);
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

    // ✅ OTIMIZAÇÃO: Rastreamento não bloqueante (fire and forget)
    if (typeof trackEvent === 'function') {
      trackEvent('checkout_form_filled', {
        plan: selectedPlan,
        has_email: !!email,
        has_whatsapp: !!whatsapp,
        about_who: quiz.about_who,
        style: quiz.style,
      }).catch(() => {});
    }
    

    // Detectar se usuário está em rota portuguesa (Brasil)
    const isPortuguese = window.location.pathname.startsWith('/pt');
    
    const caktoConfig = getCaktoConfigByDomain();
    const CAKTO_PAYMENT_URL = caktoConfig.url;
    
    console.log('🌍 [Checkout] Detecção de locale:', {
      currentPath: window.location.pathname,
      isPortuguese,
      paymentProvider: isPortuguese ? 'cakto' : 'stripe'
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
      
      const normalizedWhatsApp = formatWhatsappForCakto(whatsapp);
      
      // ✅ Normalizar email: corrige domínios comuns com erros de digitação (ex: incloud.com -> icloud.com)
      const normalizedEmail = sanitizeEmail(email);
      
      // Obter parâmetros da URL para verificar se veio de um link de restore
      const urlParams = new URLSearchParams(window.location.search);
      
      // ✅ SEMPRE SALVAR O QUIZ NO BANCO PRIMEIRO (antes de criar o pedido)
      // Isso garante que o quiz_id esteja disponível para os links do WhatsApp
      let quizData;
      
      // ✅ PRIORIDADE 1: Buscar por session_id se disponível
      const quizSessionId = (() => {
        if (typeof quiz.session_id === 'string' && quiz.session_id.trim() !== '') return quiz.session_id;
        const answersSessionId = quiz.answers?.['session_id'];
        if (typeof answersSessionId === 'string' && answersSessionId.trim() !== '') return answersSessionId;
        return getOrCreateQuizSessionId();
      })();
      
      if (quizSessionId && !quiz.id) {
        // Tentar buscar quiz no banco por session_id
        logger.debug('Buscando quiz no banco por session_id', {
          session_id: quizSessionId,
          email: normalizedEmail
        });
        
        const { data: existingQuizBySession, error: sessionError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('session_id', quizSessionId)
          .single();
        
        if (!sessionError && existingQuizBySession) {
          logger.debug('Quiz encontrado por session_id, atualizando com email/WhatsApp', {
            quiz_id: existingQuizBySession.id,
            session_id: quizSessionId
          });
          
          // Fazer UPSERT para atualizar com email/WhatsApp
          const { data: updatedQuiz, error: updateError } = await supabase
            .from('quizzes')
            .upsert({
              ...existingQuizBySession,
              customer_email: normalizedEmail,
              customer_whatsapp: normalizedWhatsApp as string,
              answers: { ...existingQuizBySession.answers, customer_email: normalizedEmail, customer_whatsapp: normalizedWhatsApp },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'session_id',
              ignoreDuplicates: false
            })
            .select()
            .single();
          
          if (!updateError && updatedQuiz) {
            quizData = updatedQuiz;
            logger.debug('Quiz atualizado com sucesso via UPSERT', {
              quiz_id: quizData.id,
              session_id: quizSessionId,
              customer_email: quizData.customer_email,
              customer_whatsapp: quizData.customer_whatsapp
            });
            checkoutLogger.log('quiz_created', { quiz_id: quizData.id, session_id: quizSessionId, found_by_session: true });
          } else {
            logger.warn('Erro ao fazer UPSERT do quiz por session_id, tentando buscar novamente', updateError);
            // Se falhar, usar o quiz encontrado
            quizData = existingQuizBySession;
          }
        } else {
          // Se não encontrou, aguardar 1-2s e tentar novamente (pode estar salvando ainda)
          logger.debug('Quiz não encontrado por session_id, aguardando e tentando novamente...', {
            session_id: quizSessionId,
            error: sessionError?.message
          });
          
          await new Promise(resolve => setTimeout(resolve, 1500)); // Aguardar 1.5s
          
          const { data: retryQuiz, error: retryError } = await supabase
            .from('quizzes')
            .select('*')
            .eq('session_id', quizSessionId)
            .single();
          
          if (!retryError && retryQuiz) {
            logger.debug('Quiz encontrado após retry, fazendo UPSERT', {
              quiz_id: retryQuiz.id,
              session_id: quizSessionId
            });
            
            const { data: updatedQuiz, error: updateError } = await supabase
              .from('quizzes')
              .upsert({
                ...retryQuiz,
                customer_email: normalizedEmail,
                customer_whatsapp: normalizedWhatsApp as string,
                answers: { ...retryQuiz.answers, customer_email: normalizedEmail, customer_whatsapp: normalizedWhatsApp },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'session_id',
                ignoreDuplicates: false
              })
              .select()
              .single();
            
            if (!updateError && updatedQuiz) {
              quizData = updatedQuiz;
              checkoutLogger.log('quiz_created', { quiz_id: quizData.id, session_id: quizSessionId, found_by_session_retry: true });
            } else {
              quizData = retryQuiz;
            }
          }
        }
      }
      
      // ✅ PRIORIDADE 2: Se quiz tem ID direto, usar esse
      if (!quizData && quiz.id) {
        // Quiz já existe no banco (foi restaurado ou já foi salvo) - atualizar com email/WhatsApp
        logger.debug('Quiz já existe no banco, atualizando com email/WhatsApp', {
          quiz_id: quiz.id,
          email: normalizedEmail,
          whatsapp: normalizedWhatsApp
        });
        
        // Fazer UPSERT por ID
        const { data: existingQuiz, error: fetchError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', quiz.id)
          .single();
        
        if (!fetchError && existingQuiz) {
          const { data: updatedQuiz, error: updateError } = await supabase
            .from('quizzes')
            .update({
              customer_email: normalizedEmail,
              customer_whatsapp: normalizedWhatsApp as string,
              answers: { ...existingQuiz.answers, customer_email: normalizedEmail, customer_whatsapp: normalizedWhatsApp },
              updated_at: new Date().toISOString()
            })
            .eq('id', quiz.id)
            .select()
            .single();
          
          if (updateError || !updatedQuiz) {
            logger.error('Erro ao atualizar quiz existente', updateError);
            quizData = existingQuiz; // Usar quiz original se update falhar
          } else {
            quizData = updatedQuiz;
            logger.debug('Quiz atualizado com sucesso', {
              quiz_id: quizData.id,
              customer_email: quizData.customer_email,
              customer_whatsapp: quizData.customer_whatsapp
            });
            checkoutLogger.log('quiz_created', { quiz_id: quizData.id, updated: true });
          }
        }
      }
      
      // ✅ SIMPLIFICAÇÃO: Se quiz não tem ID, confiar que create-checkout vai fazer UPSERT por session_id
      // Não precisamos criar quiz aqui - create-checkout já faz UPSERT por session_id
      // Isso evita duplicação de lógica e garante que o quiz seja salvo na mesma transação do pedido
      if (!quizData) {
        logger.info('Quiz não encontrado no banco, create-checkout fará UPSERT por session_id', {
          step: 'quiz_creation',
          session_id: quizSessionId,
          customer_email: normalizedEmail
        });
        
        // ✅ LIMPAR FLAG DE RETRY: Se havia flag de retry, limpar (create-checkout vai salvar)
        const needsRetry = (quiz as any)?._needsRetry === true;
        if (needsRetry) {
          try {
            const quizWithoutRetryFlag = { ...quiz };
            delete (quizWithoutRetryFlag as any)._needsRetry;
            delete (quizWithoutRetryFlag as any)._retryAttempts;
            delete (quizWithoutRetryFlag as any)._lastRetryError;
            localStorage.setItem('pending_quiz', JSON.stringify(quizWithoutRetryFlag));
            logger.info('Flag de retry removida (create-checkout vai salvar)', {
              step: 'quiz_retry_cleanup',
              session_id: quizSessionId
            });
          } catch (cleanupError) {
            logger.warn('Erro ao limpar flag de retry (não crítico)', cleanupError);
          }
        }
      }

      // Limpar orders órfãs antes de criar nova (não bloqueante)
      cleanupOrphanOrders(email).catch(err => {
        console.warn('⚠️ [Checkout] Erro ao limpar orders órfãs (não bloqueante):', err);
      });

      // ✅ NOVO FLUXO: Usar edge function create-checkout para criar quiz + pedido em transação atômica
      // Garantir que amount_cents é sempre um número válido
      // ✅ Preço fixo: R$ 47,90 (apenas Brasil, BRL)
      const caktoConfigForOrder = getCaktoConfig();
      const amountCents = caktoConfigForOrder.amount_cents;
      
      if (amountCents <= 0) {
        logger.error('Valor do pedido inválido', undefined, { step: 'order_creation', amountCents, planPrice: plan.price, isPortuguese });
        throw new Error('Valor do pedido inválido');
      }

      // Preparar dados do quiz para a edge function
      const quizForCheckout = {
        about_who: quizData.about_who || quiz.about_who,
        relationship: quizData.relationship || quiz.relationship,
        style: quizData.style || quiz.style,
        language: quizData.language || quiz.language || currentLanguage,
        vocal_gender: quizData.vocal_gender || quiz.vocal_gender || null,
        qualities: quizData.qualities || quiz.qualities,
        memories: quizData.memories || quiz.memories,
        message: quizData.message || quiz.message || null,
        key_moments: quizData.key_moments || quiz.key_moments || null,
        occasion: quizData.occasion || quiz.occasion || null,
        desired_tone: quizData.desired_tone || quiz.desired_tone || null,
        answers: quizData.answers || quiz.answers || {}
      };

      // Tentar usar edge function create-checkout
      let order: any = null;
      let useCreateCheckoutFunction = true;

      try {
        checkoutLogger.log('order_creation_started', { quiz_id: quizData.id, using_create_checkout: true });

        // Usar backend API ao invés de Edge Function
        const checkoutResult = await apiHelpers.createCheckout({
          session_id: quizSessionId,
          quiz: quizForCheckout,
          customer_email: normalizedEmail,
          customer_whatsapp: normalizedWhatsApp,
          plan: selectedPlan,
          amount_cents: amountCents,
          provider: 'cakto', // Apenas Cakto agora
          transaction_id: transactionId
        });

        if (!checkoutResult || !checkoutResult.success) {
          logger.warn('⚠️ [Checkout] Backend API create-checkout falhou, usando fallback:', {
            error: checkoutResult?.success === false ? checkoutResult.error : undefined,
            step: 'order_creation'
          });
          useCreateCheckoutFunction = false;
        } else {
          // Sucesso! Usar quiz_id e order_id retornados
          const returnedQuizId = checkoutResult.quiz_id;
          const returnedOrderId = checkoutResult.order_id;

          // Buscar order completo
          const { data: orderData, error: orderFetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', returnedOrderId)
            .single();

          if (orderFetchError || !orderData) {
            logger.warn('⚠️ [Checkout] Erro ao buscar order criado pela edge function, usando fallback:', orderFetchError);
            useCreateCheckoutFunction = false;
          } else {
            order = orderData;
            quizData = { ...quizData, id: returnedQuizId }; // Atualizar quizData com ID retornado
            checkoutLogger.log('order_created', { 
              order_id: order.id, 
              quiz_id: returnedQuizId,
              created_via_function: true 
            });
            logger.info('✅ [Checkout] Quiz e pedido criados via create-checkout:', {
              quiz_id: returnedQuizId,
              order_id: order.id
            });
            
            // ✅ CORREÇÃO: Limpar session_id após criar pedido com sucesso
            // Isso garante que o próximo pedido terá um novo session_id
            clearQuizSessionId();
            logger.info('✅ [Checkout] session_id limpo após criar pedido');
          }
        }
      } catch (functionError: any) {
        logger.warn('⚠️ [Checkout] Exceção ao chamar create-checkout, usando fallback:', functionError);
        useCreateCheckoutFunction = false;
      }

      // FALLBACK: Se edge function falhou, usar fluxo antigo (criar pedido separadamente)
      if (!useCreateCheckoutFunction || !order) {
        logger.info('🔄 [Checkout] Usando fluxo fallback (criação separada de quiz e pedido)');
        checkoutLogger.log('order_creation_started', { quiz_id: quizData?.id, using_fallback: true });

        // ✅ FALLBACK: Se quiz não foi criado pelo create-checkout, criar agora
        if (!quizData || !quizData.id) {
          logger.info('Criando quiz no fallback (create-checkout falhou)', {
            step: 'quiz_creation_fallback',
            session_id: quizSessionId
          });

          const quizForValidation: ValidationQuizData = {
            about_who: quiz.about_who,
            relationship: quiz.relationship,
            style: quiz.style,
            language: currentLanguage,
            vocal_gender: quiz.vocal_gender || null,
            qualities: quiz.qualities,
            memories: quiz.memories,
            message: quiz.message,
          };

          const validationResult = validateQuiz(quizForValidation, { strict: false });
          if (!validationResult.valid) {
            const errorMessage = formatValidationErrors(validationResult.errors);
            throw new Error(`Dados do questionário inválidos: ${errorMessage}`);
          }

          const sanitizedQuiz = sanitizeQuiz(quizForValidation);
          const quizPayload: QuizPayload = {
            user_id: null,
            customer_email: normalizedEmail,
            customer_whatsapp: normalizedWhatsApp as string,
            about_who: sanitizedQuiz.about_who,
            relationship: sanitizedQuiz.relationship,
            style: sanitizedQuiz.style,
            language: currentLanguage,
            vocal_gender: sanitizedQuiz.vocal_gender || null,
            qualities: sanitizedQuiz.qualities,
            memories: sanitizedQuiz.memories,
            message: sanitizedQuiz.message,
            key_moments: quiz.key_moments,
            occasion: quiz.occasion || null,
            desired_tone: quiz.desired_tone || null,
            answers: { ...quiz.answers, customer_email: normalizedEmail, customer_whatsapp: normalizedWhatsApp, session_id: quizSessionId },
            transaction_id: transactionId,
            session_id: quizSessionId as string // ✅ Usar session_id para UPSERT idempotente
          };

          const insertResult = await insertQuizWithRetry(quizPayload);
          if (!insertResult.success || !insertResult.data || !insertResult.data.id) {
            // Se falhou, tentar adicionar à fila antes de lançar erro
            try {
              const queued = await enqueueQuizToServer(quizPayload, insertResult.error);
              if (queued) {
                logger.warn('Quiz adicionado à fila do servidor (fallback)', { 
                  step: 'quiz_creation_fallback',
                  customer_email: normalizedEmail,
                });
              }
            } catch (queueError) {
              logger.error('Erro ao adicionar quiz à fila (fallback)', queueError);
            }
            throw new Error(`Erro ao salvar questionário: ${insertResult.error?.message || 'Erro desconhecido'}`);
          }
          quizData = insertResult.data;
          logger.info('Quiz criado com sucesso no fallback', {
            step: 'quiz_creation_fallback',
            quiz_id: quizData.id
          });
        }

        // Criar pedido (fluxo antigo)
        const orderPayload = {
          quiz_id: quizData.id,
          user_id: null,
          plan: selectedPlan as 'standard' | 'express',
          amount_cents: amountCents,
          status: 'pending' as const,
          provider: (isPortuguese ? 'cakto' : 'stripe') as 'cakto' | 'stripe',
          payment_provider: (isPortuguese ? 'cakto' : 'stripe') as 'cakto' | 'stripe',
          customer_email: normalizedEmail,
          customer_whatsapp: normalizedWhatsApp as string,
          transaction_id: transactionId
        } as Database['public']['Tables']['orders']['Insert'] & { customer_whatsapp: string };

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert(orderPayload)
          .select()
          .single();

        orderCreated = orderData;

        if (orderError) {
          logger.error('Erro ao criar pedido (fallback)', orderError, { step: 'order_creation' });
          // Tentar limpar quiz órfão se order falhar
          try {
            const { error: deleteError } = await supabase
              .from('quizzes')
              .delete()
              .eq('id', quizData.id);
            
            if (deleteError) {
              logger.error('Erro ao fazer rollback do quiz', deleteError, { step: 'rollback_quiz' });
            }
          } catch (rollbackError) {
            logger.error('Erro ao executar rollback', rollbackError);
          }
          throw new Error(`Erro ao criar pedido: ${orderError.message}`);
        }

        if (!orderData || !orderData.id) {
          logger.error('Order data or ID missing (fallback)', undefined, { step: 'order_creation' });
          throw new Error('Dados do pedido inválidos');
        }

        order = orderData;
        checkoutLogger.log('order_created', { order_id: order.id, created_via_fallback: true });
        
        // ✅ CORREÇÃO: Limpar session_id após criar pedido com sucesso
        // Isso garante que o próximo pedido terá um novo session_id
        clearQuizSessionId();
        logger.info('✅ [Checkout] session_id limpo após criar pedido (fallback)');
      }

      // PASSO 3: Processar pagamento (Stripe ou Cakto)
      // ✅ CRÍTICO: Verificar isPortuguese ANTES de qualquer coisa
      const isPortugueseCheck = window.location.pathname.startsWith('/pt');
      console.log('🌍 [Checkout] Verificando fluxo de pagamento:', {
        isPortuguese,
        isPortugueseCheck,
        pathname: window.location.pathname,
        willUseCakto: isPortugueseCheck
      });
      
      if (isPortugueseCheck) {
        // ✅ FLUXO CAKTO - Redirecionar IMEDIATAMENTE após criar o pedido
        console.log('✅ [Cakto] Fluxo Cakto detectado - iniciando processo de pagamento');
        console.log('✅ [Cakto] Order criado:', {
          orderId: order.id,
          email,
          whatsapp: normalizedWhatsApp,
          language: currentLanguage
        });
        logger.debug('Fluxo Cakto detectado');
        
        // Gerar URL da Cakto ANTES de qualquer outra operação
        let caktoUrl: string;
        try {
          caktoUrl = generateCaktoUrl(
            order.id,
            email,
            normalizedWhatsApp,
            currentLanguage,
            utms || {}
          );
          console.log('✅ [Cakto] URL gerada com sucesso:', {
            orderId: order.id,
            urlLength: caktoUrl.length,
            urlPreview: caktoUrl.substring(0, 100),
            isValid: caktoUrl && caktoUrl.startsWith('http')
          });
        } catch (urlError) {
          console.error('❌ [Cakto] Erro ao gerar URL:', urlError);
          toast.error('Erro ao gerar URL de pagamento. Tente novamente.');
          setProcessing(false); // ✅ Manter apenas em caso de erro real (não redirecionamento)
          return;
        }
        
        // Validar URL
        if (!caktoUrl || !caktoUrl.startsWith('http')) {
          console.error('❌ [Cakto] URL inválida:', caktoUrl);
          toast.error('Erro ao gerar URL de pagamento. Tente novamente.');
          setProcessing(false); // ✅ Manter apenas em caso de erro real (não redirecionamento)
          return;
        }
        
        // ✅ OTIMIZAÇÃO: Registrar eventos após redirecionar (não bloqueante)
        setTimeout(() => {
          try {
            const caktoConfigLog = getCaktoConfig();
            checkoutLogger.log('checkout_requested', { 
              order_id: order.id,
              plan: plan?.name || selectedPlan,
              price: caktoConfigLog.amount_cents,
              provider: 'cakto',
              language: currentLanguage
            });
          } catch (error) {
            void error;
          }
        }, 0);
        
        // ✅ OTIMIZAÇÃO: Todas as operações em background após redirecionar (não bloqueantes)
        setTimeout(() => {
          // Salvar URL no pedido
          supabase
            .from('orders')
            .update({ cakto_payment_url: caktoUrl })
            .eq('id', order.id)
            .catch(() => {});
          
          // Limpar localStorage
          try {
            localStorage.removeItem('pending_quiz');
            localStorage.removeItem('selected_plan');
            localStorage.removeItem('checkout_draft');
            localStorage.removeItem(`checkout_logs_${transactionId}`);
          } catch (error) {
            void error;
          }

          // Tracking
          if (typeof trackEvent === 'function') {
            trackEvent('payment_initiated', {
              order_id: order.id,
              plan: plan?.name || selectedPlan,
              amount: amountCents,
              currency: 'BRL',
              email,
              has_whatsapp: !!normalizedWhatsApp,
              payment_provider: 'cakto',
            }).catch(() => {});
          }
          
          supabase.functions.invoke('track-payment-click', {
            body: { order_id: order.id, source: 'checkout' }
          }).catch(() => {});
        }, 0);
        
        // ✅ REDIRECIONAMENTO IMEDIATO - SEM DELAYS
        console.log('🚀 [Cakto] ========== INICIANDO REDIRECIONAMENTO ==========');
        console.log('🚀 [Cakto] Order ID:', order.id);
        console.log('🚀 [Cakto] URL completa:', caktoUrl);
        console.log('🚀 [Cakto] URL preview:', caktoUrl.substring(0, 150));
        
        // ✅ processing já foi definido no início da função após validações
        // ✅ IMPORTANTE: NÃO resetar processing aqui - manter loading até redirecionamento
        // ✅ Redirecionamento INSTANTÂNEO - o mais rápido possível
        
        // Forçar redirecionamento - múltiplas tentativas
        // Método 1: window.location.replace (preferido)
        try {
          console.log('🚀 [Cakto] Tentando window.location.replace...');
          window.location.replace(caktoUrl);
          console.log('✅ [Cakto] window.location.replace executado com sucesso');
        } catch (e) {
          console.error('❌ [Cakto] Erro no replace:', e);
          // Tentar href imediatamente se replace falhar
          try {
            console.log('🚀 [Cakto] Tentando window.location.href...');
            window.location.href = caktoUrl;
          } catch (e2) {
            console.error('❌ [Cakto] Erro no href também:', e2);
            // Método 3: Criar link e clicar
            try {
              const link = document.createElement('a');
              link.href = caktoUrl;
              link.target = '_self';
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              console.log('✅ [Cakto] Link.click() executado');
            } catch (e3) {
              console.error('❌ [Cakto] Todos os métodos falharam:', e3);
            }
          }
        }
        
        console.log('🚀 [Cakto] ========== FIM DO REDIRECIONAMENTO ==========');
        return;
      }

      // FLUXO STRIPE PARA OUTROS PAÍSES
      // ✅ processing já foi definido no início da função após validações
      
      // Usar plan que já foi validado anteriormente
      logger.log('checkout_requested', { 
        order_id: order.id,
        plan: plan?.name || selectedPlan,
        price: plan?.price || amountCents,
        provider: 'stripe'
      });

      // Mapear plano para formato da edge function (apenas express em português)
      const mappedPlan = 'pt_express';

      const utmQuery = getUtmQueryString(false); // Não incluir params existentes
      const successPath = `/${currentLanguage}/payment/success${utmQuery}`;
      const cancelPath = `/${currentLanguage}/checkout${utmQuery}`;
      const successUrl = `${window.location.origin}${successPath}`;
      const cancelUrl = `${window.location.origin}${cancelPath}`;
      
      // ✅ VALIDAÇÃO 2: Validar URLs
      try {
        new URL(successUrl);
        new URL(cancelUrl);
      } catch (urlError) {
        throw new Error('URLs de redirecionamento inválidas');
      }
      
      // ✅ VALIDAÇÃO 3: Validar email (já validado antes, mas garantir novamente)
      if (!email || !emailSchema.safeParse(email).success) {
        throw new Error('Email inválido');
      }
      
      // ✅ VALIDAÇÃO 4: Validar order.id
      if (!order.id) {
        throw new Error('ID do pedido ausente');
      }
      
      const checkoutPayload = {
        plan: mappedPlan,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: normalizedEmail,
        customer_whatsapp: normalizedWhatsApp as string,
        metadata: {
          orderId: order.id,
          language: currentLanguage,
          customer_whatsapp: normalizedWhatsApp
        }
      };

      // ✅ OTIMIZAÇÃO: Logs removidos para velocidade

      // Timeout de 30 segundos para evitar espera indefinida
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);

      let session: StripeCheckoutResponse | null = null;
      
      try {
        const result = await supabase.functions.invoke(
          'stripe-checkout',
          { 
            body: checkoutPayload,
            signal: controller.signal as any
          }
        ) as { data: StripeCheckoutResponse | null; error: unknown };
        
        clearTimeout(timeoutId);
        
        // ✅ PRIORIDADE 1: Verificar se há erro HTTP ou erro no result.error
        if (result?.error) {
          const errorMessage = extractErrorMessage(result.error, result);
          throw new Error(errorMessage);
        }
        
        // ✅ PRIORIDADE 2: Verificar se data existe
        if (!result?.data) {
          throw new Error('Resposta do servidor de pagamento está vazia');
        }
        
        // ✅ PRIORIDADE 3: Verificar success === false ANTES de acessar outras propriedades
        if (result.data.success === false) {
          const errorMessage = result.data.error || result.data.message || 'Erro ao criar checkout';
          throw new Error(errorMessage);
        }
        
        // ✅ Se chegou aqui, success deve ser true
        session = result.data;
        
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        
        const err = error as { name?: string; message?: string };
        
        if (err?.name === 'AbortError') {
          throw new Error('Tempo limite excedido. Tente novamente.');
        }
        
        // Se já é um Error com mensagem, relançar
        if (error instanceof Error) {
          throw error;
        }
        
        // Caso contrário, criar novo Error
        const errorMessage = extractErrorMessage(error);
        throw new Error(errorMessage);
      }

      // ✅ VALIDAR: session.success deve ser true, sessionId e url devem existir
      if (!session || session.success !== true) {
        const errorMessage = session?.error || session?.message || 'Resposta do Stripe inválida';
        throw new Error(errorMessage);
      }
      
      if (!session.sessionId || !session.url) {
        throw new Error('Resposta do Stripe incompleta. Tente novamente.');
      }

      logger.log('checkout_received', { 
        session_id: session.sessionId,
        has_url: !!session.url
      });

      // ✅ OTIMIZAÇÃO: Limpar localStorage em background (não bloqueante)
      setTimeout(() => {
        try {
          localStorage.removeItem('pending_quiz');
          localStorage.removeItem('selected_plan');
          localStorage.removeItem('checkout_draft');
          localStorage.removeItem(`checkout_logs_${transactionId}`);
        } catch (error) {
          void error;
        }
      }, 0);

      // Validação final de segurança
      if (!session.url || typeof session.url !== 'string') {
        throw new Error('URL de pagamento inválida. Tente novamente.');
      }

      // ✅ OTIMIZAÇÃO: Tracking em background
      setTimeout(() => {
        if (typeof trackEvent === 'function') {
          trackEvent('payment_initiated', {
            order_id: order.id,
            plan: plan?.name || selectedPlan,
            amount: plan?.price || amountCents,
            currency: 'BRL',
            email,
            has_whatsapp: !!normalizedWhatsApp,
            payment_provider: 'stripe',
          }).catch(() => {});
        }
      }, 0);
      
      const checkoutUrl = session.url;
      
      // ✅ IMPORTANTE: NÃO resetar processing aqui - manter loading até redirecionamento
      // ✅ Redirecionamento INSTANTÂNEO - o mais rápido possível
      window.location.href = checkoutUrl;
      
    } catch (error: unknown) {
      setProcessing(false);
      setLastClickTime(0); // Resetar para permitir nova tentativa
      
      // Usar a função extractErrorMessage que já foi definida no escopo acima
      const actualErrorMessage = extractErrorMessage(error);
      
      // ✅ CRÍTICO: Se o pedido foi criado e estamos no fluxo Cakto, tentar redirecionar mesmo com erro
      const isPortuguese = window.location.pathname.startsWith('/pt');
      if (isPortuguese && orderCreated && orderCreated.id) {
        console.log('⚠️ [Cakto] Erro ocorreu mas pedido foi criado, tentando redirecionar mesmo assim...', {
          orderId: orderCreated.id,
          error: actualErrorMessage
        });
        
        try {
          // Tentar gerar URL da Cakto e redirecionar
          const normalizedWhatsApp = formatWhatsappForCakto(whatsapp);
          const currentLanguage = getCurrentLanguage();
          const caktoUrl = generateCaktoUrl(
            orderCreated.id,
            email,
            normalizedWhatsApp,
            currentLanguage,
            utms || {}
          );
          
          if (caktoUrl && caktoUrl.startsWith('http')) {
            console.log('🚀 [Cakto] Redirecionando apesar do erro...', { caktoUrl: caktoUrl.substring(0, 100) });
            // ✅ Não resetar processing - manter "Processando..." até redirecionar
            window.location.replace(caktoUrl);
            return; // Não mostrar erro se redirecionou
          }
        } catch (redirectError) {
          console.error('❌ [Cakto] Erro ao tentar redirecionar após erro:', redirectError);
          // Continuar para mostrar erro ao usuário
        }
      }
      
      // ✅ OTIMIZAÇÃO: Log e tracking de erro em background (não bloqueante)
      setTimeout(() => {
        try {
          if (typeof trackEvent === 'function') {
            trackEvent('payment_error', {
              order_id: orderCreated?.id || 'unknown',
              plan: selectedPlan,
              error_message: actualErrorMessage,
              payment_provider: isPortuguese ? 'cakto' : 'stripe',
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

  const togglePlay = (index: number) => {
    const audio = getAudioElement(index);
    if (!audio) return;
    
    // Adicionar event listeners na primeira vez que o áudio é usado
    if (!audio.hasAttribute('data-listeners-added')) {
      audio.setAttribute('data-listeners-added', 'true');
      
      const handleLoadedMetadata = () => {
        setDurations(prev => ({ ...prev, [index]: audio.duration }));
      };
      
      const handleTimeUpdate = () => {
        setCurrentTimes(prev => ({ ...prev, [index]: audio.currentTime }));
      };
      
      const handleEnded = () => {
        setCurrentlyPlaying(null);
        setCurrentTimes(prev => ({ ...prev, [index]: 0 }));
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
    }
    
    if (currentlyPlaying === index) {
      audio.pause();
      setCurrentlyPlaying(null);
    } else {
      // Pausar outros áudios
      Object.keys(audioElementsRef.current).forEach(key => {
        const otherIndex = parseInt(key);
        if (otherIndex !== index) {
          const otherAudio = audioElementsRef.current[otherIndex];
          if (otherAudio) {
            otherAudio.pause();
            otherAudio.currentTime = 0;
          }
        }
      });
      
      audio.play().catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
      });
      setCurrentlyPlaying(index);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ MOVER useEffect ANTES dos return early para evitar erro de hooks
  // Verificar se quiz está carregado - usar useEffect para redirecionar apenas após tentativas de carregamento
  useEffect(() => {
    // ✅ Evitar redirecionamentos múltiplos
    if (isRedirectingRef.current) {
      console.log('⚠️ [Checkout] Já está redirecionando, ignorando...');
      return;
    }
    
    // ✅ Se tem quiz no estado, não redirecionar
    if (quiz) {
      console.log('✅ [Checkout] Quiz encontrado no estado, não redirecionando');
      return;
    }
    
    // ✅ Se ainda está carregando, aguardar
    if (loading) {
      console.log('⏳ [Checkout] Ainda carregando, aguardando...');
      return;
    }
    
    // ✅ Verificar se já processou - se não processou ainda, aguardar
    if (!hasProcessedRef.current) {
      console.log('⚠️ [Checkout] Ainda não processou, aguardando...');
      return;
    }
    
    // ✅ VERIFICAÇÃO CRÍTICA: Verificar localStorage ANTES de redirecionar
    // Isso evita redirecionamento quando o quiz foi carregado mas o estado ainda não atualizou
    const localStorageQuiz = localStorage.getItem('pending_quiz');
    const sessionStorageQuiz = sessionStorage.getItem('pending_quiz');
    
    if (localStorageQuiz || sessionStorageQuiz) {
      console.log('✅ [Checkout] Quiz encontrado no localStorage/sessionStorage, aguardando atualização do estado...', {
        hasLocalStorage: !!localStorageQuiz,
        hasSessionStorage: !!sessionStorageQuiz,
        timestamp: new Date().toISOString()
      });
      
      // Aguardar mais um pouco para dar tempo ao estado atualizar
      const checkTimeout = setTimeout(() => {
        // Verificar novamente se o quiz foi carregado no estado
        if (quiz) {
          console.log('✅ [Checkout] Quiz foi carregado no estado após verificação');
          return;
        }
        
        // Se ainda não tem quiz no estado, tentar carregar manualmente
        if (localStorageQuiz) {
          try {
            const quizData = JSON.parse(localStorageQuiz);
            if (quizData.about_who && quizData.style) {
              console.log('✅ [Checkout] Carregando quiz do localStorage manualmente após timeout');
              setQuiz(quizData);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('❌ [Checkout] Erro ao carregar quiz do localStorage manualmente:', error);
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
        console.log('✅ [Checkout] Quiz encontrado antes do redirecionamento, cancelando redirecionamento');
        if (finalCheck && !quiz) {
          // Tentar carregar do localStorage uma última vez
          try {
            const quizData = JSON.parse(finalCheck);
            if (quizData.about_who && quizData.style) {
              console.log('✅ [Checkout] Carregando quiz do localStorage na última tentativa');
              setQuiz(quizData);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('❌ [Checkout] Erro ao carregar quiz na última tentativa:', error);
          }
        }
        return;
      }
      
      if (!loading && !quiz && !isRedirectingRef.current) {
        const quizPath = getQuizPath();
        console.log('❌ [Checkout] Quiz não carregado após todas as tentativas, redirecionando para quiz:', quizPath);
        console.log('📋 [Checkout] Estado atual:', { 
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
    console.log('⏳ Checkout em loading state');
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

  console.log('✅ Checkout renderizando com quiz:', quiz);

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
          <div className="order-1 lg:order-2 space-y-2 md:space-y-4">
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
                      setEmailError('');
                      setButtonError(false); // Limpar erro do botão ao digitar
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
                        const formatted = formatWhatsApp(e.target.value);
                        setWhatsapp(formatted);
                        setWhatsappError('');
                        setButtonError(false); // Limpar erro do botão ao digitar
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
            <Card className="compact-card hidden md:block">
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
            <Card className="compact-card hidden md:block">
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
