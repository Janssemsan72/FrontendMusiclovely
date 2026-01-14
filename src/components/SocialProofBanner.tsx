import React, { useState, useEffect } from 'react';
import { useSocialProofData, type SocialProofMessage } from '@/hooks/useSocialProofData';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface SocialProofBannerProps {
  intervalMin?: number; // segundos
  intervalMax?: number; // segundos
  displayDuration?: number; // segundos
}

export default function SocialProofBanner({
  intervalMin = 2,
  intervalMax = 4,
  displayDuration = 2
}: SocialProofBannerProps) {
  const { messages, loading } = useSocialProofData();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Função para obter inicial do nome
  const getInitial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  // Função para obter cor do avatar baseado no nome (usando gradiente primário)
  const getAvatarGradient = (name: string): string => {
    // Usar gradiente baseado no nome para variar cores
    const gradients = [
      'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-600)) 100%)',
      'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
      'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  };


  // Efeito para gerenciar ciclo de banners
  useEffect(() => {
    if (loading) {
      return;
    }

    if (messages.length === 0) {
      setIsVisible(false);
      return;
    }

    // Resetar e mostrar quando houver mensagens
    setCurrentIndex(0);
    setIsVisible(true);
    setIsExiting(false);

    // Se houver apenas 1 mensagem, mostrar e não rotacionar
    if (messages.length === 1) {
      return;
    }

    // Timer para alternar banners
    let intervalTimer: NodeJS.Timeout;
    let displayTimer: NodeJS.Timeout;
    let hideTimer: NodeJS.Timeout;

    const scheduleNext = () => {
      // Tempo de exibição do banner atual
      displayTimer = setTimeout(() => {
        // Esconder banner atual com animação
        setIsExiting(true);
        
        // Após animação de saída, mudar para próximo banner
        hideTimer = setTimeout(() => {
          setCurrentIndex((prev) => {
            const nextIndex = (prev + 1) % messages.length;
            return nextIndex;
          });
          setIsExiting(false);
          setIsVisible(true);
          
          // Intervalo aleatório antes de mostrar próximo banner
          const randomInterval = Math.floor(
            Math.random() * (intervalMax - intervalMin + 1) + intervalMin
          ) * 1000;
          
          intervalTimer = setTimeout(() => {
            scheduleNext();
          }, randomInterval);
        }, 300); // Tempo da animação de saída
      }, displayDuration * 1000);
    };

    // Iniciar ciclo após primeiro banner aparecer
    const startCycle = setTimeout(() => {
      scheduleNext();
    }, displayDuration * 1000);

    return () => {
      clearTimeout(startCycle);
      clearTimeout(intervalTimer);
      clearTimeout(displayTimer);
      clearTimeout(hideTimer);
    };
  }, [loading, messages.length, intervalMin, intervalMax, displayDuration]);

  // Não renderizar se estiver carregando ou não houver mensagens
  if (loading || messages.length === 0) {
    return null;
  }

  // Não renderizar se não estiver visível e não estiver saindo
  if (!isVisible && !isExiting) {
    return null;
  }

  const currentMessage: SocialProofMessage | undefined = messages[currentIndex];
  
  // Verificar se a mensagem existe e tem avatarUrl
  if (!currentMessage || !currentMessage.avatarUrl) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        @keyframes slideInTop {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideOutTop {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .social-proof-banner {
          animation: fadeIn 0.3s ease-out forwards;
          will-change: opacity;
        }

        .social-proof-banner.exiting {
          animation: fadeOut 0.3s ease-in forwards;
        }

      `}</style>
      
      <div
        className={`w-full max-w-full social-proof-banner ${
          isExiting ? 'exiting' : ''
        }`}
      >
        <div className="bg-background/95 backdrop-blur-sm border border-primary/20 rounded-lg shadow-sm px-2 py-1.5 flex items-center gap-2 min-w-0 overflow-hidden">
          {/* Avatar com imagem real */}
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage 
              src={currentMessage.avatarUrl} 
              alt={currentMessage.name}
              className="object-cover"
              onError={(e) => {
                // Se a imagem falhar, mostrar fallback
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <AvatarFallback 
              className="text-white font-semibold text-sm"
              style={{
                background: getAvatarGradient(currentMessage.name)
              }}
            >
              {getInitial(currentMessage.name)}
            </AvatarFallback>
          </Avatar>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-foreground text-[11px] font-medium leading-tight truncate">
              {currentMessage.message}
            </p>
            <p className="text-muted-foreground text-[9px] truncate">
              {currentMessage.timeAgo}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
