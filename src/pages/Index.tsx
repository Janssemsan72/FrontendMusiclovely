import React, { memo, Suspense, useEffect, useRef, useState } from "react";

// ✅ OTIMIZAÇÃO PERFORMANCE: Lazy load do Header para reduzir bundle inicial
const Header = React.lazy(() => import("@/components/Header"));
import HeroSection from "@/components/HeroSection";

import { useUtmParams } from "@/hooks/useUtmParams";
import { useUtmifyTracking } from "@/hooks/useUtmifyTracking";
import { Mail } from "@/utils/iconImports";

// ✅ OTIMIZAÇÃO: Lazy load de todos os componentes não-críticos com tratamento de erro
const VinylPlayer = React.lazy(() => {
  return import("@/components/VinylPlayer").catch((err) => {
    console.error('Erro ao carregar VinylPlayer:', err);
    throw err;
  });
});
const HowItWorks = React.lazy(() => {
  return import("@/components/HowItWorks").catch((err) => {
    console.error('Erro ao carregar HowItWorks:', err);
    throw err;
  });
});
const Testimonials = React.lazy(() => {
  return import("@/components/Testimonials").catch((err) => {
    console.error('Erro ao carregar Testimonials:', err);
    throw err;
  });
});
const PricingSection = React.lazy(() => {
  return import("@/components/PricingSection").catch((err) => {
    console.error('Erro ao carregar PricingSection:', err);
    throw err;
  });
});
const FAQ = React.lazy(() => {
  return import("@/components/FAQ").catch((err) => {
    console.error('Erro ao carregar FAQ:', err);
    throw err;
  });
});
const Footer = React.lazy(() => {
  return import("@/components/Footer").catch((err) => {
    console.error('Erro ao carregar Footer:', err);
    throw err;
  });
});

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
  // ✅ CORREÇÃO PRODUÇÃO: Prevenir renderização duplicada
  const hasRenderedRef = useRef(false);
  
  useEffect(() => {
    if (hasRenderedRef.current) {
      console.error('❌ [Index] Componente Index está sendo renderizado duas vezes!');
      return;
    }
    hasRenderedRef.current = true;
  }, []);
  
  // ✅ OTIMIZAÇÃO PERFORMANCE: Usar hooks diretamente (já otimizados internamente)
  const { hasUtms } = useUtmParams();
  const { trackEvent } = useUtmifyTracking();
  
  // UTMs são capturados automaticamente pelo hook

  // ✅ OTIMIZAÇÃO FASE 1.1: Deferir useScrollAnimations para não bloquear renderização inicial
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const initScrollAnimations = () => {
      if (cancelled) return;
      // Importar e inicializar scroll animations apenas quando necessário
      import('@/hooks/use-scroll-animations').then(({ useScrollAnimations }) => {
        if (cancelled) return;
        // Criar observer manualmente (não usar hook diretamente)
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                entry.target.classList.remove('opacity-0', 'translate-y-8');
                observer.unobserve(entry.target);
              }
            });
          },
          {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          }
        );

        const elements = document.querySelectorAll('.scroll-animate:not(#radiola)');
        elements.forEach((el) => {
          observer.observe(el);
        });
      }).catch(() => {});
    };

    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(initScrollAnimations, { timeout: 2000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(initScrollAnimations, 2000);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  // ✅ OTIMIZAÇÃO PERFORMANCE: Deferir tracking de homepage_viewed para não bloquear renderização inicial
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
      const id = w.requestIdleCallback(schedule, { timeout: 6000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(schedule, 5000);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [trackEvent, hasUtms]);

  // ✅ OTIMIZAÇÃO FASE 1.3: Preload condicional de Quiz/Checkout quando usuário está próximo de seções com botões
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    let prefetchedQuiz = false;
    let prefetchedCheckout = false;

    const checkScrollAndPreload = () => {
      if (cancelled) return;
      
      const scrollContainer = document.getElementById('main-scroll-container');
      const scrollY = scrollContainer ? scrollContainer.scrollTop : win.pageYOffset;
      const viewportHeight = win.innerHeight;
      
      // ✅ CORREÇÃO BUG 1: Preload baseado apenas em scroll, sem depender de elementos DOM
      // Preload Quiz quando usuário scrollou mais de 1 viewport
      const shouldPreloadQuiz = scrollY > viewportHeight * 0.5 && scrollY < viewportHeight * 3;
      
      if (shouldPreloadQuiz && !prefetchedQuiz) {
        prefetchedQuiz = true;
        import('../pages/Quiz').catch(() => {});
      }
      
      // Preload Checkout apenas quando usuário está muito próximo do final
      if (scrollY > viewportHeight * 3 && !prefetchedCheckout) {
        prefetchedCheckout = true;
        import('../pages/Checkout').catch(() => {});
      }
    };

    // ✅ CORREÇÃO BUG 1: Deferir verificação inicial para garantir que DOM está pronto
    const initialCheck = () => {
      if (cancelled) return;
      // Aguardar um frame para garantir que DOM está renderizado
      win.requestAnimationFrame(() => {
        if (!cancelled) {
          checkScrollAndPreload();
        }
      });
    };
    
    if (win && 'requestIdleCallback' in win) {
      const w = win as any;
      w.requestIdleCallback(initialCheck, { timeout: 1000 });
    } else if (win) {
      win.setTimeout(initialCheck, 1000);
    }

    // Throttle scroll listener
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        win.requestAnimationFrame(() => {
          if (!cancelled) {
            checkScrollAndPreload();
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const scrollContainer = document.getElementById('main-scroll-container');
    const target = scrollContainer || win;
    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cancelled = true;
      target.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // ✅ OTIMIZAÇÃO FASE 1.4: Deferir deep link hash handling
  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    let cancelled = false;
    const handleHash = () => {
      if (cancelled) return;
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
    };

    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(handleHash, { timeout: 1000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = globalThis.setTimeout(handleHash, 1000);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* ✅ OTIMIZAÇÃO PERFORMANCE: Header lazy loaded com fallback mínimo */}
      <Suspense fallback={<div className="fixed top-0 left-0 right-0 z-50 h-[80px] bg-background border-b border-border/20" />}>
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
        <HeroSection />
        
        <main className="container mx-auto px-3 sm:px-4 py-0 sm:py-4 space-y-4 sm:space-y-12">
        
        {/* ✅ OTIMIZAÇÃO FASE 1.2: Aumentar rootMargin para 600px em componentes abaixo do fold */}
        <div id="radiola" className="scroll-mt-20 mt-8 sm:mt-0">
          <div className="grid gap-4 sm:gap-6 items-center max-w-6xl mx-auto px-4">
            <div className="flex justify-center">
              <LazySection minHeight={420} rootMargin="600px 0px">
                <VinylPlayer />
              </LazySection>
            </div>
          </div>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-1">
          <LazySection minHeight={520} rootMargin="600px 0px">
            <HowItWorks />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-2" id="testimonials-section">
          <Suspense fallback={null}>
            <Testimonials />
          </Suspense>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-3">
          <LazySection minHeight={520} rootMargin="600px 0px">
            <PricingSection />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-4">
          <LazySection minHeight={520} rootMargin="600px 0px">
            <FAQ />
          </LazySection>
        </div>
        
        <div className="scroll-animate scroll-animate-delay-5">
          <section id="contato" className="container mx-auto px-4 py-8 sm:py-10 text-center scroll-mt-24">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">Entre em Contato</h2>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg mb-4">Entre em contato conosco. Estamos prontos para ajudar você a criar a música perfeita para seus momentos especiais!</p>
            <div className="flex items-center justify-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <a href="mailto:contato@musiclovely.com" className="text-sm sm:text-base text-primary hover:underline">
                contato@musiclovely.com
              </a>
            </div>
          </section>
        </div>
      </main>

      {/* ✅ OTIMIZAÇÃO FASE 1.4: Footer com IntersectionObserver para preload apenas quando visível */}
      <div className="scroll-animate scroll-animate-delay-6">
        <LazySection minHeight={300} rootMargin="200px 0px">
          <Footer />
        </LazySection>
      </div>
      </div>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
