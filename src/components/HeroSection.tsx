import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "@/utils/iconImports";
// ✅ DIFERENCIAÇÃO: Usar avatares diferentes da página inicial (não os mesmos das avaliações)
// Avatares da página inicial vêm de public/testimonials
const heroAvatar1 = "/testimonials/avatar-1.webp";
const heroAvatar2 = "/testimonials/avatar-2.webp";
const heroAvatar3 = "/testimonials/avatar-3.webp";
import { useUtmParams } from "@/hooks/useUtmParams";

// ✅ OTIMIZAÇÃO: Versão única 240p para carregamento INSTANTÂNEO (otimizado para mobile - 99% dos usuários)
// Fallback para vídeo original se versão comprimida não existir
const heroVideoSources = {
  minimal: '/video/musiclovaly-240p.webm',  // Versão padrão - carregamento INSTANTÂNEO (< 1s) - 163KB
  original: '/video/musiclovaly.webm'        // Vídeo original (fallback se versão comprimida não existir)
};
const heroPoster = '/images/collage-memories-new.webp';

export default function HeroSection() {
  const { navigateWithUtms } = useUtmParams();

  const [videoReady, setVideoReady] = React.useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = React.useState(true); // ✅ CORREÇÃO: Carregar vídeo imediatamente
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const mountedRef = React.useRef(true);
  const videoLoadStartedRef = React.useRef(false); // ✅ OTIMIZAÇÃO: Ref para rastrear se vídeo já começou a carregar

  // Função para gerar links (apenas português)
  const getLocalizedLink = (path: string) => path;

  // Navegação para quiz
  const handleQuizClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Preload agressivo do Quiz antes de redirecionar
    import('../pages/Quiz').catch(() => {});
    const quizPath = getLocalizedLink('/quiz');
    navigateWithUtms(quizPath);
  };

  // ✅ CORREÇÃO: Verificar disponibilidade do vídeo antes de carregar (usar a função)
  const checkVideoAvailability = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return response.ok;
    } catch {
      return false;
    }
  };

  // ✅ CORREÇÃO: Simplificar - vídeo já está setado para carregar (shouldLoadVideo = true)
  // Forçar carregamento e play do vídeo quando o elemento estiver montado
  React.useEffect(() => {
    mountedRef.current = true;
    
    // ✅ CORREÇÃO: Forçar carregamento do vídeo imediatamente após montagem
    const timer = setTimeout(() => {
      if (mountedRef.current && videoRef.current) {
        const video = videoRef.current;
        console.log('[HeroSection] Forçando carregamento do vídeo', {
          readyState: video.readyState,
          networkState: video.networkState,
          currentSrc: video.currentSrc
        });
        
        if (video.readyState === 0) {
          video.load();
        }
        
        // ✅ CORREÇÃO: Tentar play para garantir que o vídeo inicie
        video.play().catch((err) => {
          // Ignorar erros de autoplay (normal em alguns navegadores)
          console.log('[HeroSection] Autoplay bloqueado (normal):', err);
        });
        
        // ✅ CORREÇÃO: Se vídeo já tem dados, mostrar imediatamente
        if (video.readyState >= 2) {
          setVideoReady(true);
        }
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // ✅ OTIMIZAÇÃO: Listener para evento online (recarregar vídeo quando conexão voltar)
  React.useEffect(() => {
    const handleOnline = () => {
      if (mountedRef.current && shouldLoadVideo && !videoReady && videoRef.current) {
        // Recarregar vídeo quando conexão voltar
        videoRef.current.load();
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [shouldLoadVideo, videoReady]);

  // ✅ OTIMIZAÇÃO: Versão única 240p - sem upgrade progressivo (otimizado para mobile)

  return (
    <section className="relative overflow-hidden">
      <div className="w-full px-3 pb-2 sm:px-4 sm:pt-0 sm:pb-12 md:px-10 md:pt-0 md:pb-16 text-center">
        <div className="max-w-sm sm:max-w-md md:max-w-2xl mx-auto">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl hero-image-container"
            style={{ 
              aspectRatio: '640/269',
              backgroundColor: '#E7D5C4'
            }}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50"
              style={{ 
                zIndex: 0,
                willChange: 'auto'
              }}
              aria-hidden="true"
            />
            <picture>
              <source 
                srcSet={`${heroPoster} 1x, ${heroPoster} 2x`}
                type="image/webp"
                sizes="(max-width: 640px) 384px, 640px"
              />
              <img
                className="absolute inset-0 w-full h-full object-cover z-10"
                src={heroPoster}
                alt="Memórias especiais"
                fetchPriority="high"
                width={640}
                height={269}
                sizes="(max-width: 640px) 384px, (max-width: 1024px) 640px, 1024px"
                loading="eager"
                decoding="async"
                style={{ willChange: 'auto' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const posterFallback = '/images/collage-memories-DEqE2yio.webp';
                  if (target.src !== posterFallback) {
                    target.src = posterFallback;
                  }
                }}
              />
            </picture>
            {shouldLoadVideo ? (
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-30"}`}
                style={{ zIndex: 20 }} // ✅ CORREÇÃO: z-index maior que a imagem (z-10) para ficar por cima
                poster={heroPoster}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onLoadedData={() => {
                  if (mountedRef.current) {
                    console.log('[HeroSection] Vídeo loadedData - definindo como ready');
                    setVideoReady(true);
                  }
                }}
                onCanPlay={() => {
                  if (mountedRef.current) {
                    console.log('[HeroSection] Vídeo canPlay - definindo como ready');
                    setVideoReady(true);
                  }
                }}
                onCanPlayThrough={() => {
                  if (mountedRef.current) {
                    console.log('[HeroSection] Vídeo canPlayThrough - definindo como ready');
                    setVideoReady(true);
                  }
                }}
                onPlaying={() => {
                  if (mountedRef.current) {
                    console.log('[HeroSection] Vídeo está reproduzindo');
                    setVideoReady(true);
                  }
                }}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  const error = target.error;
                  
                  // ✅ CORREÇÃO: Log de erro para debug (apenas em dev)
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('[HeroSection] Erro ao carregar vídeo:', {
                      errorCode: error?.code,
                      errorMessage: error?.message,
                      currentSrc: target.currentSrc,
                      networkState: target.networkState,
                      readyState: target.readyState
                    });
                  }
                  
                  // ✅ CORREÇÃO: Se houver erro, tentar recarregar após um delay
                  if (mountedRef.current) {
                    setVideoReady(false);
                    // Tentar recarregar vídeo
                    if (videoRef.current) {
                      setTimeout(() => {
                        if (videoRef.current && mountedRef.current) {
                          videoRef.current.load();
                        }
                      }, 1000);
                    }
                  }
                }}
                onLoadStart={() => {
                  // ✅ CORREÇÃO: Log de debug quando vídeo começa a carregar
                  if (process.env.NODE_ENV === 'development' && mountedRef.current) {
                    console.log('[HeroSection] Vídeo começou a carregar:', {
                      currentSrc: videoRef.current?.currentSrc,
                      networkState: videoRef.current?.networkState,
                      readyState: videoRef.current?.readyState
                    });
                  }
                }}
                onProgress={() => {
                  // ✅ CORREÇÃO: Mostrar vídeo quando tiver dados suficientes
                  if (mountedRef.current && videoRef.current) {
                    const video = videoRef.current;
                    if (video.buffered.length > 0) {
                      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                      const duration = video.duration;
                      if (duration > 0) {
                        const percentLoaded = (bufferedEnd / duration) * 100;
                        if (percentLoaded > 20 && !videoReady) {
                          // ✅ CORREÇÃO: Se mais de 20% carregado, mostrar vídeo imediatamente
                          console.log(`[HeroSection] Vídeo ${percentLoaded.toFixed(0)}% carregado - mostrando`);
                          setVideoReady(true);
                        }
                      } else if (video.readyState >= 2 && !videoReady) {
                        // ✅ CORREÇÃO: Se readyState >= 2 (HAVE_CURRENT_DATA), mostrar vídeo
                        console.log('[HeroSection] Vídeo tem dados suficientes - mostrando');
                        setVideoReady(true);
                      }
                    }
                  }
                }}
              >
                {/* ✅ OTIMIZAÇÃO: Versão única 240p (163KB) para carregamento instantâneo - otimizado para mobile */}
                <source src={heroVideoSources.minimal} type="video/webm" />
                <source src={heroVideoSources.original} type="video/webm" />
              </video>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          </div>
        
        <div className="mt-1 mb-1">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base font-semibold">
            <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
            <span>A plataforma #1 de músicas personalizadas</span>
          </div>
        </div>
        
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 leading-tight px-2">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Músicas Personalizadas para Seus Momentos Especiais
          </span>
        </h1>
        
        {/* Copy 2 Versões */}
        <div className="mb-3 p-2.5 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg border border-yellow-500/30 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg sm:text-xl">🎁</span>
            <span className="font-bold text-sm sm:text-base">Pague 1, Leve 2 Versões</span>
          </div>
        </div>

        <p 
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-3 sm:mb-4 px-2 sm:px-4 leading-relaxed"
          style={{
            minHeight: '3.5rem',
            contentVisibility: 'auto'
          }}
        >
          Propostas, casamentos, tributos — feitos com amor. Crie música personalizada que conta sua história única.
        </p>

        <div className="flex justify-center items-center mb-4 sm:mb-6 px-2">
          <Button
            size="lg"
            onClick={handleQuizClick}
            className="text-base sm:text-lg md:text-xl px-8 sm:px-10 md:px-12 py-4 sm:py-5 md:py-6 rounded-2xl bg-primary hover:bg-primary-600 text-white shadow-soft hover:shadow-medium transition-all hover:scale-105 w-full sm:w-auto group btn-pulse"
          >
            <span className="flex items-center justify-center gap-2 sm:gap-3">
              {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
              <span>🎵 Criar Sua Música Aqui</span>
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </div>


        <div className="flex items-center justify-center gap-2 sm:gap-4 px-2">
          <div className="flex -space-x-2 sm:-space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft aspect-square">
              <img src={heroAvatar1} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} sizes="48px" loading="lazy" decoding="async" fetchPriority="low" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft aspect-square">
              <img src={heroAvatar2} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} sizes="48px" loading="lazy" decoding="async" fetchPriority="low" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft aspect-square">
              <img src={heroAvatar3} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} sizes="48px" loading="lazy" decoding="async" fetchPriority="low" />
            </div>
          </div>
          <div className="text-left">
            <div className="flex gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="text-amber-400 text-xs sm:text-sm">★</span>
              ))}
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              Mais de 500 músicas criadas com amor
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
