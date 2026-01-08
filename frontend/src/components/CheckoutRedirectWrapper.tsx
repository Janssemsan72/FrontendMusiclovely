import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Wrapper component que intercepta URLs do WhatsApp ANTES do Checkout ser renderizado
 * Redireciona IMEDIATAMENTE para Cakto se detectar message_id na URL
 */
export default function CheckoutRedirectWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lastSearchRef = useRef<string>(''); // ✅ FASE 5: Ref para rastrear último search
  
  useEffect(() => {
    // ✅ FASE 5: Verificar se search não mudou antes de processar
    if (lastSearchRef.current === location.search) {
      return;
    }
    lastSearchRef.current = location.search;
    // ⚠️ CRÍTICO: Verificar ANTES de qualquer renderização
    const urlParams = new URLSearchParams(location.search);
    const messageId = urlParams.get('message_id');
    const orderId = urlParams.get('order_id');
    const edit = urlParams.get('edit');
    
    // ✅ CORREÇÃO: NÃO redirecionar se for URL do quiz (com ou sem edit=true)
    // O botão "Ajustar Detalhes" deve permitir visualizar/editar o quiz, não redirecionar para Cakto
    // Mesmo que tenha message_id, order_id, etc., se for rota de quiz, não redirecionar
    const isQuizRoute = location.pathname.includes('/quiz');
    
    if (isQuizRoute) {
      return; // Não redirecionar, permitir que o quiz seja visualizado/editado
    }
    
    // Se tem message_id, significa que veio do WhatsApp e deve ir direto para Cakto
    // ⚠️ CRÍTICO: Verificar também se a URL contém parâmetros do checkout interno (restore, quiz_id, token)
    // Se contém, significa que está tentando acessar o checkout interno mas deveria ir para Cakto
    // Mas APENAS se for rota de checkout, não de quiz
    const isCheckoutRoute = location.pathname.includes('/checkout');
    // ✅ CORREÇÃO: Também redirecionar se for rota home (/pt, /en, /es) com order_id e message_id
    const isHomeRoute = /^\/(pt|en|es)(\/)?$/.test(location.pathname);
    const hasCheckoutParams = urlParams.get('restore') === 'true' || urlParams.get('quiz_id') || urlParams.get('token');
    
    // Redirecionar se:
    // 1. For rota de checkout E tiver os parâmetros necessários, OU
    // 2. For rota home (/pt, /en, /es) E tiver message_id e order_id (vindo do WhatsApp)
    const shouldRedirect = (
      (isCheckoutRoute && (messageId || hasCheckoutParams) && orderId) ||
      (isHomeRoute && messageId && orderId)
    ) && !window.location.href.includes('pay.cakto.com.br');
    
    if (shouldRedirect) {
      // Buscar pedido e redirecionar IMEDIATAMENTE
      supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
        .then(({ data: orderData, error }) => {
          if (!error && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            const CAKTO_PAYMENT_URL = 'https://pay.cakto.com.br/d877u4t_665160';
            // ✅ CORREÇÃO: Detectar locale da rota atual para usar no redirect_url
            const localeMatch = location.pathname.match(/^\/(pt|en|es)/);
            const locale = localeMatch ? localeMatch[1] : 'pt';
            
            // ✅ CORREÇÃO: Normalizar WhatsApp e garantir prefixo 55
            let normalizedWhatsapp = orderData.customer_whatsapp.replace(/\D/g, '');
            if (!normalizedWhatsapp.startsWith('55')) {
              normalizedWhatsapp = `55${normalizedWhatsapp}`;
            }
            // ✅ CORREÇÃO: Payment success não usa prefixo de idioma
            const origin = window.location.origin;
            const redirectUrl = `${origin}/payment-success`;
            
            const caktoParams = new URLSearchParams();
            caktoParams.set('order_id', orderData.id);
            caktoParams.set('email', orderData.customer_email);
            // ✅ Cakto usa 'phone' para pré-preencher o telefone (não 'whatsapp')
            caktoParams.set('phone', normalizedWhatsapp);
            caktoParams.set('language', locale);
            caktoParams.set('redirect_url', redirectUrl);
            
            // ⚠️ CRÍTICO: NÃO adicionar parâmetros do checkout interno (restore, quiz_id, token)
            // A URL da Cakto deve conter APENAS os parâmetros necessários para pagamento
            
            const caktoUrl = `${CAKTO_PAYMENT_URL}?${caktoParams.toString()}`;
            
            // ✅ Registrar clique no botão "Finalizar Agora" (tracking)
            supabase.functions.invoke('track-payment-click', {
              body: {
                order_id: orderData.id,
                source: 'whatsapp_redirect'
              }
            }).catch(() => {
              // Não bloquear o redirecionamento se o tracking falhar
            });
            
            // ⚠️ CRÍTICO: Usar window.location.replace para evitar que o React Router intercepte
            // Isso substitui a URL atual no histórico, impedindo que o usuário volte para o checkout interno
            window.location.replace(caktoUrl);
          }
        })
        .catch(() => {
          // Erro silencioso - não bloquear renderização
        });
    }
  }, [location.search]);
  
  // ✅ OTIMIZAÇÃO MOBILE: Não bloquear renderização - redirecionar em background
  // O redirecionamento já está sendo feito no useEffect acima
  // Sempre renderizar children para não bloquear a página
  
  return <>{children}</>;
}

