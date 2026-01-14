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
  const [shouldLoadVideo, setShouldLoadVideo] = React.useState(false);
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

  // ✅ OTIMIZAÇÃO: Verificar disponibilidade do vídeo antes de carregar
  const checkVideoAvailability = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return response.ok;
    } catch {
      return false;
    }
  };

  // ✅ OTIMIZAÇÃO: O navegador automaticamente tenta os sources na ordem
  // Se versões comprimidas não existirem, ele automaticamente usa o original via fallback

  // ✅ OTIMIZAÇÃO: Carregar vídeo IMEDIATAMENTE após FCP (First Contentful Paint) para carregamento ultra rápido
  React.useEffect(() => {
    mountedRef.current = true;
    
    const loadVideo = () => {
      if (!mountedRef.current || videoLoadStartedRef.current) return;
      videoLoadStartedRef.current = true; // Marcar como iniciado
      // Ativar carregamento do vídeo IMEDIATAMENTE - versão 240p (163KB) para carregamento instantâneo
      setShouldLoadVideo(true);
    };

    // ✅ OTIMIZAÇÃO: Detectar FCP (mais rápido que LCP) para carregar vídeo o mais cedo possível
    if ('PerformanceObserver' in window) {
      try {
        // Observar FCP primeiro (mais rápido)
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
              // ✅ OTIMIZAÇÃO: Carregar vídeo IMEDIATAMENTE após FCP (sem delay)
              if (mountedRef.current) loadVideo();
              fcpObserver.disconnect();
              return;
            }
          }
        });
        
        try {
          fcpObserver.observe({ entryTypes: ['paint'] });
        } catch {
          // Se paint não for suportado, usar LCP
        }
        
        // Fallback: Observar LCP também
        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              // ✅ OTIMIZAÇÃO: Se FCP não disparou, carregar após LCP (sem delay adicional)
              if (mountedRef.current && !videoLoadStartedRef.current) {
                loadVideo();
              }
              lcpObserver.disconnect();
              return;
            }
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // ✅ OTIMIZAÇÃO: Fallback ULTRA RÁPIDO - 500ms se nenhum observer disparar
        const fallbackTimer = setTimeout(() => {
          fcpObserver.disconnect();
          lcpObserver.disconnect();
          if (mountedRef.current && !videoLoadStartedRef.current) {
            loadVideo();
          }
        }, 500);
        
        return () => {
          mountedRef.current = false;
          fcpObserver.disconnect();
          lcpObserver.disconnect();
          clearTimeout(fallbackTimer);
        };
      } catch {
        // Fallback se PerformanceObserver falhar - carregar IMEDIATAMENTE
        loadVideo();
        return () => { 
          mountedRef.current = false;
        };
      }
    } else {
      // Fallback para navegadores sem PerformanceObserver - carregar IMEDIATAMENTE
      loadVideo();
      return () => { 
        mountedRef.current = false;
      };
    }
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
        <div className="max-w-sm sm:max-w-md md:max-w-xl mx-auto">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ aspectRatio: '640/269' }}
          >
            <picture>
              <source 
                srcSet={`${heroPoster} 1x, ${heroPoster} 2x`}
                type="image/webp"
                sizes="(max-width: 640px) 384px, 640px"
              />
              <img
                className="absolute inset-0 w-full h-full object-cover"
                src={heroPoster}
                alt="Memórias especiais"
                fetchPriority="high"
                width={640}
                height={269}
                sizes="(max-width: 640px) 384px, 640px"
                loading="eager"
                decoding="async"
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
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
                poster={heroPoster}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                onLoadedData={() => {
                  setVideoReady(true);
                }}
                onCanPlay={() => {
                  setVideoReady(true);
                }}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  // Se houver erro na versão 240p, tentar vídeo original como fallback
                  if (mountedRef.current) {
                    setVideoReady(false);
                    // Recarregar vídeo com source original
                    if (videoRef.current) {
                      setTimeout(() => {
                        if (videoRef.current) {
                          videoRef.current.load();
                        }
                      }, 500);
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

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-3 sm:mb-4 px-2 sm:px-4 leading-relaxed">
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
              <img src={heroAvatar1} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft aspect-square">
              <img src={heroAvatar2} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft aspect-square">
              <img src={heroAvatar3} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
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
