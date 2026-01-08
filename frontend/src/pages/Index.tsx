import React, { memo, Suspense, useEffect, useRef, useState } from "react";
// ✅ OTIMIZAÇÃO: Lazy load de componentes não críticos acima da dobra
const Header = React.lazy(() => import("@/components/Header"));
const HeroSection = React.lazy(() => import("@/components/HeroSection"));
const Footer = React.lazy(() => import("@/components/Footer"));

import { useScrollAnimations } from "@/hooks/use-scroll-animations";
import { useTranslation } from "@/hooks/useTranslation";
import { useUtmParams } from "@/hooks/useUtmParams";
import { useUtmifyTracking } from "@/hooks/useUtmifyTracking";
import { Mail } from "lucide-react";
import { scrollToId } from "@/utils/scrollTo";

const VinylPlayer = React.lazy(() => import("@/components/VinylPlayer"));
const HowItWorks = React.lazy(() => import("@/components/HowItWorks"));
import Testimonials from "@/components/Testimonials";
const PricingSection = React.lazy(() => import("@/components/PricingSection"));
const FAQ = React.lazy(() => import("@/components/FAQ"));

function LazySection({
  children,
  minHeight,
  rootMargin,
}: {
  children: React.ReactNode;
  minHeight?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
        }
      },
      { rootMargin: rootMargin ?? '0px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={minHeight ? { minHeight } : undefined}>
      {visible ? <Suspense fallback={null}>{children}</Suspense> : null}
    </div>
  );
}

const Index = memo(() => {
  const { t } = useTranslation();
  
  // ✅ OTIMIZAÇÃO: useScrollAnimations já usa IntersectionObserver que é eficiente
  // Não precisa adiar, pois IntersectionObserver não bloqueia render
  useScrollAnimations();
  
  // Capturar e salvar UTMs na página inicial
  const { hasUtms } = useUtmParams();
  const { trackEvent, utmifyReady } = useUtmifyTracking();
  
  // UTMs são capturados automaticamente pelo hook

  // ✅ OTIMIZAÇÃO: Rastrear visualização da homepage apenas após FCP
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const schedule = async () => {
      if (cancelled) return;
      try {
        // trackEvent agora aguarda UTMify estar pronto internamente
        await trackEvent('homepage_viewed', {
          pathname: win.location.pathname,
          hasUtms,
        });
      } catch (error) {
        void error;
      }
    };

    // ✅ OTIMIZAÇÃO: Aguardar FCP antes de rastrear (reduzir de 5s para 3s)
    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(schedule, { timeout: 3000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(schedule, 3000);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [trackEvent, hasUtms, utmifyReady]);


  // Tratar deep links com hash na URL ao carregar
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    const hash = win.location.hash.replace('#', '');
    if (hash) {
      const scrollContainer = document.getElementById('main-scroll-container');
      const element = document.getElementById(hash);
      
      if (element) {
        // Offset negativo para preços aparecer ainda mais acima
        const offset = hash === 'pricing' ? -50 : 80;
        
        if (scrollContainer) {
          // Container customizado
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const currentScrollTop = scrollContainer.scrollTop;
          const elementTopRelativeToContainer = elementRect.top - containerRect.top;
          const elementTopInContainer = currentScrollTop + elementTopRelativeToContainer;
          scrollContainer.scrollTop = Math.max(0, elementTopInContainer - offset);
        } else {
          // Window scroll
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + win.pageYOffset - offset;
          win.scrollTo(0, Math.max(0, offsetPosition));
        }
      }
    }
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <Suspense fallback={<div className="h-[80px] sm:h-[88px]" />}>
        <Header />
      </Suspense>
      <div 
        id="main-scroll-container"
        className="flex-1 overflow-y-auto overflow-x-hidden main-scroll-container mt-[80px] sm:mt-[88px]"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          height: 'calc(100vh - 80px)',
        }}
      >
        <Suspense fallback={<div className="h-[400px]" />}>
          <HeroSection />
        </Suspense>
        
        <main className="container mx-auto px-3 sm:px-4 py-0 sm:py-4 space-y-4 sm:space-y-12">
        
        <div id="radiola" className="scroll-mt-20 mt-8 sm:mt-0">
          <div className="grid gap-4 sm:gap-6 items-center max-w-6xl mx-auto px-4">
            <div className="flex justify-center">
              <LazySection minHeight={420} rootMargin="0px 0px">
                <VinylPlayer />
              </LazySection>
            </div>
          </div>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-1">
          <LazySection minHeight={520}>
            <HowItWorks />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-2" id="testimonials-section">
          <Suspense fallback={
            <section className="py-16 px-4">
              <div className="container mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">Carregando depoimentos...</h2>
                </div>
              </div>
            </section>
          }>
            <Testimonials />
          </Suspense>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-3">
          <LazySection minHeight={520}>
            <PricingSection />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-4">
          <LazySection minHeight={520}>
            <FAQ />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-5">
          <section id="contato" className="container mx-auto px-4 py-8 sm:py-10 text-center scroll-mt-24">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">{t('contact.title')}</h2>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg mb-4">{t('contact.description')}</p>
            <div className="flex items-center justify-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <a href="mailto:contato@musiclovely.com" className="text-sm sm:text-base text-primary hover:underline">
                {t('footer.email')}
              </a>
            </div>
          </section>
        </div>
      </main>
      
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      </div>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
