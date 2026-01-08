import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";
// ✅ OTIMIZAÇÃO: Usar versões otimizadas 96x96 para reduzir tamanho (de 512x512 para 96x96)
import testimonial1 from "@/assets/testimonial-1-96.webp";
import testimonial2 from "@/assets/testimonial-2-96.webp";
import testimonial3 from "@/assets/testimonial-3-96.webp";
import { useTranslation } from "@/hooks/useTranslation";
import { useUtmParams } from "@/hooks/useUtmParams";

// Lista de vídeos em ordem de prioridade (fallbacks)
const heroVideoSources = [
  '/video/musiclovaly.webm',
  '/video/musiclovaly.mp4', // Fallback caso .webm não esteja disponível
];
const heroVideo = heroVideoSources[0];
const heroPoster = '/images/collage-memories-new.webp';

export default function HeroSection() {
  const { t } = useTranslation();
  const { navigateWithUtms } = useUtmParams();

  const [videoReady, setVideoReady] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);
  const [currentVideoSrc, setCurrentVideoSrc] = React.useState(heroVideo);
  const [videoErrorCount, setVideoErrorCount] = React.useState(0);

  // Função para gerar links (apenas português)
  const getLocalizedLink = (path: string) => path;

  // Navegação imediata para o quiz (preservando UTMs)
  const handleQuizClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const quizPath = getLocalizedLink('/quiz');
    navigateWithUtms(quizPath);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="w-full px-3 pb-2 sm:px-4 sm:pt-0 sm:pb-12 md:px-10 md:pt-0 md:pb-16 text-center">
        <div className="max-w-sm sm:max-w-md md:max-w-xl mx-auto">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ paddingTop: '42%' }}
          >
            <img
              className="absolute inset-0 w-full h-full object-cover"
              src={heroPoster}
              alt="Memórias especiais"
              fetchpriority="high"
              width={640}
              height={269}
              decoding="async"
              loading="eager"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const posterFallback = '/images/collage-memories-DEqE2yio.webp';
                if (target.src !== posterFallback) {
                  target.src = posterFallback;
                }
              }}
            />
            {!videoError ? (
              <video
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
                src={currentVideoSrc}
                poster={heroPoster}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                onLoadedData={() => {
                  setVideoReady(true);
                  setVideoError(false);
                }}
                onCanPlay={() => {
                  setVideoReady(true);
                  setVideoError(false);
                }}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  const currentSrc = target.src;
                  const currentIndex = heroVideoSources.findIndex((src) => currentSrc.includes(src));
                  console.error('❌ [HeroSection] Erro ao carregar vídeo:', {
                    attemptedUrl: currentVideoSrc,
                    currentSrc,
                    attempt: videoErrorCount + 1,
                    currentIndex,
                    totalSources: heroVideoSources.length,
                    networkState: target.networkState,
                    readyState: target.readyState,
                    errorCode: target.error?.code,
                  });
                  
                  // Tentar próximo fallback
                  if (currentIndex < heroVideoSources.length - 1) {
                    const nextVideo = heroVideoSources[currentIndex + 1];
                    setCurrentVideoSrc(nextVideo);
                    setVideoErrorCount((prev) => prev + 1);
                    setVideoReady(false);
                  } else {
                    setVideoError(true);
                    setVideoReady(false);
                  }
                }}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted/50">
                <p className="text-muted-foreground text-sm">Vídeo não disponível</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          </div>
        
        <div className="mt-1 mb-1">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base font-semibold">
            <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
            <span>{t('hero.platform')}</span>
          </div>
        </div>
        
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 leading-tight px-2">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('hero.title')}
          </span>
        </h1>
        
        {/* Copy 2 Versões */}
        <div className="mb-3 p-2.5 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg border border-yellow-500/30 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg sm:text-xl">🎁</span>
            <span className="font-bold text-sm sm:text-base">{t('hero.twoVersionsBenefit')}</span>
          </div>
        </div>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-3 sm:mb-4 px-2 sm:px-4 leading-relaxed">
          {t('hero.subtitle')}
        </p>

        <div className="flex justify-center items-center mb-4 sm:mb-6 px-2">
          <Button
            size="lg"
            onClick={handleQuizClick}
            className="text-base sm:text-lg md:text-xl px-8 sm:px-10 md:px-12 py-4 sm:py-5 md:py-6 rounded-2xl bg-primary hover:bg-primary-600 text-white shadow-soft hover:shadow-medium transition-all hover:scale-105 w-full sm:w-auto group btn-pulse"
          >
            <span className="flex items-center justify-center gap-2 sm:gap-3">
              {/* ✅ CORREÇÃO: Fallback para garantir texto sempre visível */}
              <span>🎵 {t('hero.cta', 'Criar Minha Música')}</span>
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </div>


        <div className="flex items-center justify-center gap-2 sm:gap-4 px-2">
          <div className="flex -space-x-2 sm:-space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft">
              <img src={testimonial1} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft">
              <img src={testimonial2} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-background overflow-hidden shadow-soft">
              <img src={testimonial3} alt="Cliente satisfeito" className="w-full h-full object-cover" width={48} height={48} loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="text-left">
            <div className="flex gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="text-amber-400 text-xs sm:text-sm">★</span>
              ))}
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              {t('hero.over500Songs')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
