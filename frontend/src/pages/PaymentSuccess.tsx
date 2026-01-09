import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MessageCircle, ChevronDown } from '@/utils/iconImports';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import { useUtmifyTracking } from '@/hooks/useUtmifyTracking';
import { clearQuizSessionId } from '@/utils/quizSync';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';

interface OrderData {
  id: string;
  customer_email?: string;
  customer_whatsapp?: string;
  status?: string;
}

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const { utms, hasUtms } = useUtmParams();
  const { trackEvent } = useUtmifyTracking();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(20);

  // Número de WhatsApp (mesmo usado em outras páginas)
  const whatsappNumber = '8591516996';

  // Preservar UTMs na página de sucesso
  useEffect(() => {
    if (hasUtms) {
      console.log('✅ UTMs preservados na página de sucesso:', utms);
    }
  }, [utms, hasUtms]);

  // Buscar dados do pedido e rastrear sucesso do pagamento
  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        // Extrair order_id da URL
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id') || urlParams.get('session_id');

        if (orderId && orderId !== 'unknown') {
          // Buscar dados do pedido no Supabase
          const { data, error } = await supabase
            .from('orders')
            .select('id, customer_email, customer_whatsapp, status')
            .eq('id', orderId)
            .single();

          if (!error && data) {
            setOrderData(data);
          } else {
            console.warn('⚠️ [PaymentSuccess] Pedido não encontrado:', error);
          }

          // Rastrear sucesso do pagamento
          trackEvent('payment_success', {
            order_id: orderId,
            pathname: window.location.pathname,
          });
        } else {
          // Rastrear mesmo sem order_id
          trackEvent('payment_success', {
            order_id: 'unknown',
            pathname: window.location.pathname,
          });
        }
      } catch (error) {
        console.error('❌ [PaymentSuccess] Erro ao buscar dados do pedido:', error);
      } finally {
        setLoading(false);
      }

      // Limpar session_id após pagamento confirmado
      clearQuizSessionId();
    };

    fetchOrderData();
  }, [trackEvent]);

  // Criar mensagem personalizada para WhatsApp
  const getWhatsAppMessage = (): string => {
    if (orderData?.id) {
      return `Olá! Meu pedido foi confirmado (ID: ${orderData.id}). Gostaria de acompanhar o status do meu pedido.`;
    }
    return 'Olá! Meu pagamento foi processado. Gostaria de acompanhar o status do meu pedido.';
  };

  // Gerar URL do WhatsApp
  const whatsappMessage = encodeURIComponent(getWhatsAppMessage());
  const whatsappUrl = `https://wa.me/55${whatsappNumber}?text=${whatsappMessage}`;

  // Função para abrir WhatsApp
  const handleWhatsAppClick = () => {
    window.open(whatsappUrl, '_blank');
    // Rastrear clique no botão WhatsApp
    trackEvent('whatsapp_button_clicked', {
      order_id: orderData?.id || 'unknown',
      source: 'payment_success',
    });
  };

  // Contador regressivo e redirecionamento automático após 20 segundos
  useEffect(() => {
    if (!loading) {
      // Contador regressivo
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Redirecionamento automático após 20 segundos
      const redirectTimer = setTimeout(() => {
        // Criar URL do WhatsApp no momento do redirecionamento
        const message = orderData?.id 
          ? `Olá! Meu pedido foi confirmado (ID: ${orderData.id}). Gostaria de acompanhar o status do meu pedido.`
          : 'Olá! Meu pagamento foi processado. Gostaria de acompanhar o status do meu pedido.';
        const encodedMessage = encodeURIComponent(message);
        const finalWhatsappUrl = `https://wa.me/55${whatsappNumber}?text=${encodedMessage}`;
        
        // Rastrear redirecionamento automático
        trackEvent('whatsapp_auto_redirect', {
          order_id: orderData?.id || 'unknown',
          source: 'payment_success',
          delay: 20000,
        });
        
        // Redirecionar para WhatsApp
        window.location.href = finalWhatsappUrl;
      }, 20000); // 20 segundos

      return () => {
        clearTimeout(redirectTimer);
        clearInterval(countdownInterval);
      };
    }
  }, [loading, orderData?.id, whatsappNumber, trackEvent]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-2 sm:p-4" style={{ background: '#F5F0EB' }}>
      <style>{`
        @keyframes successPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
          }
        }
        @keyframes shine {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        .success-circle {
          animation: successPulse 2s ease-in-out infinite;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          position: relative;
          overflow: hidden;
        }
        .success-circle::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          background-size: 200% 100%;
          animation: shine 3s ease-in-out infinite;
        }
      `}</style>
      <Card className="w-full max-w-xl bg-white shadow-xl rounded-2xl">
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="animate-in fade-in zoom-in-95 duration-700" style={{ animationDelay: '0s' }}>
              <Logo size={180} className="w-[180px] sm:w-[300px]" />
            </div>
          </div>

          {/* Círculo verde com checkmark */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div 
              className="success-circle w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center animate-in zoom-in-95 fade-in duration-700"
              style={{ animationDelay: '0.1s' }}
            >
              <CheckCircle2 
                className="w-10 h-10 sm:w-14 sm:h-14 text-white relative z-10" 
                strokeWidth={2.5}
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}
              />
            </div>
          </div>

          {/* Título "Pagamento Confirmado!" */}
          <h1 
            className="text-xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 animate-in slide-in-from-bottom-4 fade-in duration-700" 
            style={{ color: '#22c55e', animationDelay: '0.2s', textShadow: '0 2px 4px rgba(34, 197, 94, 0.1)' }}
          >
            Pagamento Confirmado!
          </h1>

          {/* Caixa verde clara com mensagem explicativa */}
          <div 
            className="p-4 sm:p-5 rounded-xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-700" 
            style={{ 
              borderColor: '#86efac', 
              backgroundColor: '#f0fdf4',
              animationDelay: '0.4s'
            }}
          >
            <p className="text-sm sm:text-base leading-relaxed text-center" style={{ color: '#166534' }}>
              Seu pagamento foi processado. Clique no botão abaixo e acompanhe o seu pedido pelo WhatsApp.
            </p>
          </div>

          {/* Seta animada apontando para baixo */}
          <div className="flex justify-center mb-2 sm:mb-4 animate-in fade-in duration-700" style={{ animationDelay: '0.6s' }}>
            <ChevronDown 
              className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" 
              style={{ color: '#22c55e', animation: 'bounce 1.5s ease-in-out infinite' }} 
            />
          </div>

          {/* Botão WhatsApp */}
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: '0.8s' }}>
            <Button
              onClick={handleWhatsAppClick}
              className="w-full hover:scale-[1.02] transition-all duration-300 text-white font-semibold shadow-md hover:shadow-xl rounded-xl py-3 sm:py-4 text-base sm:text-lg"
              style={{ 
                backgroundColor: '#22c55e',
                border: 'none',
              }}
              disabled={loading}
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
              Falar no WhatsApp
            </Button>
          </div>

          {/* Aviso de redirecionamento automático */}
          {!loading && (
            <div className="animate-in fade-in duration-700" style={{ animationDelay: '1s' }}>
              <p className="text-xs sm:text-sm leading-relaxed text-center font-medium" style={{ color: '#15803d' }}>
                Você será redirecionado automaticamente em {countdown} segundo{countdown !== 1 ? 's' : ''}...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
