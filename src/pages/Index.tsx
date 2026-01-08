import React, { memo, Suspense, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

import { useScrollAnimations } from "@/hooks/use-scroll-animations";
import { useTranslation } from "@/hooks/useTranslation";
import { useUtmParams } from "@/hooks/useUtmParams";
import { useUtmifyTracking } from "@/hooks/useUtmifyTracking";
import { Mail } from "@/utils/iconImports";
import { scrollToId } from "@/utils/scrollTo";

// ✅ OTIMIZAÇÃO: Lazy load de todos os componentes não-críticos
const VinylPlayer = React.lazy(() => import("@/components/VinylPlayer"));
const HowItWorks = React.lazy(() => import("@/components/HowItWorks"));
const Testimonials = React.lazy(() => import("@/components/Testimonials"));
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
  useScrollAnimations();
  // Capturar e salvar UTMs na página inicial
  const { hasUtms } = useUtmParams();
  const { trackEvent } = useUtmifyTracking();
  
  // UTMs são capturados automaticamente pelo hook

  // Rastrear visualização da homepage (UTMify)
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      try {
        trackEvent('homepage_viewed', {
          pathname: win.location.pathname,
          hasUtms,
        }).catch(() => {});
      } catch (error) {
        void error;
      }
    };

    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(schedule, { timeout: 5000 });
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
  }, [trackEvent, hasUtms]);


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
      <Header />
      <div 
        id="main-scroll-container"
        className="flex-1 overflow-y-auto overflow-x-hidden main-scroll-container mt-[80px] sm:mt-[88px]"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          height: 'calc(100vh - 80px)',
        }}
      >
        <HeroSection />
        
        <main className="container mx-auto px-3 sm:px-4 py-0 sm:py-4 space-y-4 sm:space-y-12">
        
        {/* ✅ OTIMIZAÇÃO: VinylPlayer carregado apenas quando visível, com rootMargin maior para preload */}
        <div id="radiola" className="scroll-mt-20 mt-8 sm:mt-0">
          <div className="grid gap-4 sm:gap-6 items-center max-w-6xl mx-auto px-4">
            <div className="flex justify-center">
              <LazySection minHeight={420} rootMargin="200px 0px">
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

      <div className="scroll-animate scroll-animate-delay-6">
        <Footer />
      </div>
      </div>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
