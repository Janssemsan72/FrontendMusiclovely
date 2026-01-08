import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "@/utils/iconImports";
import Logo from "@/components/Logo";
import { useScrollspy } from "@/hooks/use-scrollspy";
import { useTranslation } from "@/hooks/useTranslation";
// Locale removido - usando apenas português
import { scrollToId } from "@/utils/scrollTo";
import { LinkWithUtms } from "@/components/LinkWithUtms";
import { useUtmParams } from "@/hooks/useUtmParams";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { scrollManager } from "@/utils/scrollManager";

const SECTIONS = [
  { id: 'radiola', label: 'Ouça Exemplo' },
  { id: 'faq', label: 'FAQ' }
]; 

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithUtms } = useUtmParams();
  const { scrollToTop, scrollToTopInstant } = useSmoothScroll();
  
  const sectionIds = SECTIONS.map(section => section.id);
  const { activeId, scrollToSection } = useScrollspy(sectionIds, { offset: 80 });

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Throttle no scroll handler para melhor performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollContainer = document.getElementById('main-scroll-container');
          const scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
          setScrolled(scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    const scrollContainer = document.getElementById('main-scroll-container');
    const target = scrollContainer || window;
    
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, []);

  // Função para gerar links (apenas português)
  const getLocalizedLink = (path: string) => path;

  // Handler para navegação para seções da página inicial
  const handleSectionClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    const scrollContainer = document.getElementById('main-scroll-container');
    
    if (location.pathname === '/') {
      scrollManager.scrollToElement(sectionId, 80, scrollContainer || null);
    } else {
      scrollManager.scrollToTop(scrollContainer || null);
      navigateWithUtms(`/#${sectionId}`, { replace: false });
      setTimeout(() => {
        scrollManager.scrollToElement(sectionId, 80, scrollContainer || null);
      }, 400);
    }
  };

  // Handler para clique no logo - sempre vai para o topo
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isOnHomePage = location.pathname === '/';
    const scrollContainer = document.getElementById('main-scroll-container');
    
    // Fazer scroll para o topo
    scrollManager.scrollToTop(scrollContainer || null);
    
    // Se não está na home, navegar para a home
    if (!isOnHomePage) {
      navigateWithUtms('/');
      // Garantir scroll após navegação
      setTimeout(() => {
        scrollManager.scrollToTop(scrollContainer || null);
      }, 200);
    }
  };


  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-lg border-b border-border/20 transition-shadow duration-300 supports-[backdrop-filter]:bg-background/98 ${scrolled ? 'shadow-md' : 'shadow-sm'}`}>
      <div className="w-full py-3 sm:py-4 flex items-center justify-between px-4 sm:px-6 relative">
        {/* Logo à esquerda */}
        <div 
          className="flex items-center shrink-0 z-10 cursor-pointer"
          onClick={handleLogoClick}
          onMouseDown={(e) => {
            // Garantir que o evento seja capturado mesmo se houver outros handlers
            e.stopPropagation();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleLogoClick(e as any);
            }
          }}
          aria-label="Ir para o início"
          style={{ pointerEvents: 'auto' }}
        >
          <Logo size={120} className="pointer-events-none sm:w-[140px] md:w-[160px] w-[120px] h-auto" />
        </div>

        {/* Centro: Navegação - centralizado */}
        <div className="hidden md:flex items-center justify-center gap-6 sm:gap-8 absolute left-1/2 -translate-x-1/2">
          <nav className="flex items-center gap-6 sm:gap-8">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`text-xl text-foreground/80 hover:text-foreground transition-colors font-medium ${
                  activeId === section.id ? 'text-primary' : ''
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Direita: Botão Criar Música */}
        <div className="hidden md:flex items-center gap-3 z-10">
          <Button
            className="bg-primary hover:bg-primary-600 text-white rounded-2xl shadow-soft text-base font-semibold px-6 py-2.5"
            asChild
          >
            <LinkWithUtms to={getLocalizedLink('/quiz')}>{t('navigation.createMusic')}</LinkWithUtms>
          </Button>
        </div>

        {/* Mobile: Menu hamburguer no canto direito */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 sm:p-2 text-foreground hover:bg-muted rounded-lg transition-colors z-20"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X size={20} className="sm:w-6 sm:h-6" /> : <Menu size={20} className="sm:w-6 sm:h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className="text-xl text-foreground/80 hover:text-foreground transition-colors font-medium py-3 px-4 hover:bg-muted rounded-lg text-left"
              >
                {section.label}
              </button>
            ))}
            <Button
              className="bg-primary hover:bg-primary-600 text-white rounded-2xl shadow-soft w-full mt-2 text-base font-semibold py-2.5"
              asChild
            >
              <LinkWithUtms to={getLocalizedLink('/quiz')} onClick={() => setMobileMenuOpen(false)}>
                {t('navigation.createMusic')}
              </LinkWithUtms>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
