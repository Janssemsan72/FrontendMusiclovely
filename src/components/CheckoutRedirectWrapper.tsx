import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wrapper component que intercepta URLs do WhatsApp ANTES do Checkout ser renderizado
 * Redireciona IMEDIATAMENTE para Cakto se detectar message_id na URL
 */
export default function CheckoutRedirectWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lastSearchRef = useRef<string>(''); // ✅ FASE 5: Ref para rastrear último search
  
  useEffect(() => {
    const isDev = import.meta.env.DEV;

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
    // ✅ CORREÇÃO: Remover sistema de rotas com prefixo de idioma
    const isHomeRoute = /^\/$/.test(location.pathname);
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
      (async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: orderData, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

          if (!error && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            const CAKTO_PAYMENT_URL = 'https://pay.cakto.com.br/d877u4t_665160';
            // ✅ CORREÇÃO: Remover sistema de locale - sempre usar português
            const locale = 'pt';
            
            // ✅ CORREÇÃO: Normalizar WhatsApp e garantir prefixo 55
            let normalizedWhatsapp = orderData.customer_whatsapp.replace(/\D/g, '');
            if (!normalizedWhatsapp.startsWith('55')) {
              normalizedWhatsapp = `55${normalizedWhatsapp}`;
            }
            const origin = window.location.origin;
            // ✅ CORREÇÃO: Remover prefixo de idioma da URL
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
            supabase.functions
              .invoke('track-payment-click', {
                body: {
                  order_id: orderData.id,
                  source: 'whatsapp_redirect'
                }
              })
              .then(({ error: trackError }) => {
                if (trackError) {
                  if (isDev) console.warn('[CheckoutRedirectWrapper] Falha no tracking (não bloqueante)');
                }
              })
              .catch((trackError) => {
                if (isDev) console.warn('[CheckoutRedirectWrapper] Falha no tracking (não bloqueante)', trackError);
              });
            
            // ⚠️ CRÍTICO: Usar window.location.replace para evitar que o React Router intercepte
            // Isso substitui a URL atual no histórico, impedindo que o usuário volte para o checkout interno
            window.location.replace(caktoUrl);
          } else {
            if (isDev) {
              console.error('[CheckoutRedirectWrapper] Pedido não encontrado ou inválido', {
                hasError: !!error,
                hasOrderData: !!orderData,
                status: orderData?.status,
              });
            }
          }
      })().catch((err) => {
          if (isDev) console.error('[CheckoutRedirectWrapper] Erro ao buscar pedido para redirecionamento', err);
      });
    }
  }, [location.pathname, location.search]);
  
  // ✅ OTIMIZAÇÃO MOBILE: Não bloquear renderização - redirecionar em background
  // O redirecionamento já está sendo feito no useEffect acima
  // Sempre renderizar children para não bloquear a página
  
  return <>{children}</>;
}

