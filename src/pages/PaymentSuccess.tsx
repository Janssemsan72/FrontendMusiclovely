import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail, Clock, Shield, Instagram, ChevronDown, MessageCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import { useUtmifyTracking } from '@/hooks/useUtmifyTracking';
import { clearQuizSessionId } from '@/utils/quizSync';
import confetti from 'canvas-confetti';
import Logo from '@/components/Logo';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  // Preservar UTMs na página de sucesso
  const { utms, hasUtms } = useUtmParams();
  const { trackEvent } = useUtmifyTracking();

  const whatsappHref =
    'https://wa.me/5585994377151?text=Ol%C3%A1%2C%20Music%20Lovely%2C%20acabei%20de%20fazer%20meu%20pedido%20musical.';

  const [redirectSecondsLeft, setRedirectSecondsLeft] = useState(8);
  
  useEffect(() => {
    if (hasUtms) {
      console.log('✅ UTMs preservados na página de sucesso:', utms);
    }
  }, [utms, hasUtms]);
  
  // Rastrear sucesso do pagamento
  useEffect(() => {
    // Extrair order_id da URL se disponível
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id') || urlParams.get('session_id') || 'unknown';
    
    trackEvent('payment_success', {
      order_id: orderId,
      pathname: window.location.pathname,
    });
    
    // ✅ CORREÇÃO: Limpar session_id após pagamento confirmado (backup)
    // Isso garante que o próximo pedido terá um novo session_id
    clearQuizSessionId();
    
  }, [trackEvent]);

  // Animação de confetes ao carregar a página
  useEffect(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Confetes da esquerda
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Confetes da direita
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Explosão inicial no centro
    confetti({
      ...defaults,
      particleCount: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#22c55e', '#f97316', '#3b82f6', '#E4405F', '#8B7355']
    });

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRedirectSecondsLeft(8);

    const intervalId = window.setInterval(() => {
      setRedirectSecondsLeft((prev) => {
        if (prev <= 1) {
          window.location.href = whatsappHref;
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [whatsappHref]);

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
        @keyframes checkmarkDraw {
          0% {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
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
      <Card className="w-full max-w-xl bg-white shadow-xl">
        <CardContent className="p-3 sm:p-6 space-y-1.5 sm:space-y-2">
          {/* Logo */}
          <div className="flex justify-center mb-2 sm:mb-5">
            <div className="animate-in fade-in zoom-in-95 duration-700" style={{ animationDelay: '0s' }}>
              <Logo size={60} className="w-[60px] sm:w-[100px]" />
            </div>
          </div>

          {/* Círculo verde com checkmark - Animação moderna */}
          <div className="flex justify-center mb-2 sm:mb-4">
            <div 
              className="success-circle w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center animate-in zoom-in-95 fade-in duration-700"
              style={{ animationDelay: '0.1s' }}
            >
              <CheckCircle2 
                className="w-8 h-8 sm:w-12 sm:h-12 text-white relative z-10" 
                strokeWidth={2.5}
                style={{ 
                  animationDelay: '0.3s',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}
              />
            </div>
          </div>

          {/* Título - Animação de entrada */}
          <h1 
            className="text-lg sm:text-2xl font-bold text-center mb-3 sm:mb-5 animate-in slide-in-from-bottom-4 fade-in duration-700" 
            style={{ color: '#22c55e', animationDelay: '0.2s', textShadow: '0 2px 4px rgba(34, 197, 94, 0.1)' }}
          >
            {t('paymentSuccess.title')}
          </h1>

          {/* Seção 1: Pagamento Processado (Verde) - Animação de entrada */}
          <div 
            className="p-2.5 sm:p-3.5 rounded-xl border-2 animate-in slide-in-from-left-4 fade-in duration-700 hover:scale-[1.02] hover:shadow-md transition-all shadow-sm backdrop-blur-sm" 
            style={{ borderColor: '#86efac', backgroundColor: '#f0fdf4', animationDelay: '0.4s' }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1 sm:p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                <Shield 
                  className="w-4 h-4 sm:w-5 sm:h-5 animate-in zoom-in-95 duration-500" 
                  style={{ color: '#22c55e', animationDelay: '0.6s' }} 
                />
              </div>
              <p className="text-xs leading-relaxed font-medium" style={{ color: '#166534' }}>
                {t('paymentSuccess.paymentProcessed')}
              </p>
            </div>
          </div>

          {/* Seção 2: Tempo de Entrega (Laranja) - Animação de entrada */}
          <div 
            className="p-2.5 sm:p-3.5 rounded-xl border-2 animate-in slide-in-from-right-4 fade-in duration-700 hover:scale-[1.02] hover:shadow-md transition-all shadow-sm backdrop-blur-sm" 
            style={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed', animationDelay: '0.6s' }}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-1 sm:p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)' }}>
                <Clock 
                  className="w-4 h-4 sm:w-5 sm:h-5 animate-in zoom-in-95 duration-500" 
                  style={{ color: '#f97316', animationDelay: '0.8s' }} 
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs mb-0.5 sm:mb-1" style={{ color: '#f97316' }}>
                  {t('paymentSuccess.deliveryTime.title')}
                </h3>
                <p className="text-xs font-bold mb-1 sm:mb-1.5" style={{ color: '#ea580c' }}>
                  {t('paymentSuccess.deliveryTime.mainMessage')}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#9a3412' }}>
                  {t('paymentSuccess.deliveryTime.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Seção 3: Acompanhe seu pedido (Azul) - Animação de entrada */}
          <div 
            className="p-2.5 sm:p-3.5 rounded-xl border-2 animate-in slide-in-from-left-4 fade-in duration-700 hover:scale-[1.02] hover:shadow-md transition-all shadow-sm backdrop-blur-sm" 
            style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff', animationDelay: '0.8s' }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1 sm:p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <Mail 
                  className="w-4 h-4 sm:w-5 sm:h-5 animate-in zoom-in-95 duration-500" 
                  style={{ color: '#3b82f6', animationDelay: '1s' }} 
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs mb-0.5 sm:mb-1" style={{ color: '#3b82f6' }}>
                  {t('paymentSuccess.emailTracking.title')}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#1e40af' }}>
                  {t('paymentSuccess.emailTracking.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Seção Redes Sociais - Animação de entrada */}
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: '1s' }}>
            <h3 className="text-center font-semibold mb-1 sm:mb-2 text-xs sm:text-sm" style={{ color: '#8B7355' }}>
              {t('paymentSuccess.socialMedia.title')}
            </h3>
            {/* Seta animada apontando para o botão */}
            <div className="flex justify-center mb-1 sm:mb-2">
              <ChevronDown 
                className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" 
                style={{ color: '#8B7355', animation: 'bounce 1.5s ease-in-out infinite' }}
              />
            </div>
            <div className="flex flex-col gap-2 sm:gap-2.5">
              <Button
                onClick={() => {
                  window.location.href = whatsappHref;
                }}
                className="w-full hover:scale-[1.02] transition-all duration-300 animate-in zoom-in-95 duration-500 text-white font-semibold shadow-md hover:shadow-xl rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                  animationDelay: '1.1s'
                }}
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                {t('paymentSuccess.socialMedia.whatsapp')}
              </Button>
              <Button
                onClick={() => window.open('https://instagram.com/musiclovely.oficial', '_blank')}
                className="w-full hover:scale-[1.02] transition-all duration-300 animate-in zoom-in-95 duration-500 text-white font-semibold shadow-md hover:shadow-xl rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm"
                style={{ 
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  border: 'none',
                  animationDelay: '1.2s'
                }}
              >
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                {t('paymentSuccess.socialMedia.instagram')}
              </Button>
            </div>
            <p className="text-[11px] sm:text-xs text-center mt-2" style={{ color: '#8B7355' }}>
              {t('paymentSuccess.redirecting', { countdown: redirectSecondsLeft })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
