import React from "react";
import { useLocation } from "react-router-dom";
import Logo from "@/components/Logo";
import { useTranslation } from "@/hooks/useTranslation";
// Locale removido - apenas português
import { Mail, Heart, Music } from "lucide-react";
import { useUtmParams } from "@/hooks/useUtmParams";
import { LinkWithUtms } from "@/components/LinkWithUtms";

export default function Footer() {
  const { t } = useTranslation();
  const location = useLocation();
  const { navigateWithUtms } = useUtmParams();

  // Seções da home removidas
  const HOME_SECTIONS = [];

  // Função para gerar links (apenas português)
  const getLocalizedLink = (path: string) => path;

  // Handler para navegação para seções da home
  const handleSectionClick = (sectionId: string) => {
    const isOnHomePage = location.pathname === '/';

    if (isOnHomePage) {
      // Já está na home, posicionar na seção
      const scrollContainer = document.getElementById('main-scroll-container');
      const element = document.getElementById(sectionId);
      
      if (element) {
        if (scrollContainer) {
          // Container customizado
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const currentScrollTop = scrollContainer.scrollTop;
          const elementTopRelativeToContainer = elementRect.top - containerRect.top;
          const elementTopInContainer = currentScrollTop + elementTopRelativeToContainer;
          
          // Offset negativo para preços aparecer ainda mais acima
          const offset = sectionId === 'pricing' ? -50 : 80;
          scrollContainer.scrollTop = Math.max(0, elementTopInContainer - offset);
        } else {
          // Window scroll
          const elementPosition = element.getBoundingClientRect().top;
          const offset = sectionId === 'pricing' ? -100 : 80;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo(0, Math.max(0, offsetPosition));
        }
      }
    } else {
      // Está em outra página, navegar para home com hash
      navigateWithUtms(`${homePath}#${sectionId}`, { replace: false });
      
      // Aguardar navegação e posicionar na seção
      setTimeout(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        const element = document.getElementById(sectionId);
        
        if (element) {
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const currentScrollTop = scrollContainer.scrollTop;
            const elementTopRelativeToContainer = elementRect.top - containerRect.top;
            const elementTopInContainer = currentScrollTop + elementTopRelativeToContainer;
            const offset = sectionId === 'pricing' ? -50 : 80;
            scrollContainer.scrollTop = Math.max(0, elementTopInContainer - offset);
          } else {
            const elementPosition = element.getBoundingClientRect().top;
            const offset = sectionId === 'pricing' ? -50 : 80;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo(0, Math.max(0, offsetPosition));
          }
        }
      }, 300);
    }
  };

  // Handler para navegação para páginas específicas
  const handlePageClick = (path: string) => {
    try {
      const localizedPath = getLocalizedLink(path);
      
      // Navegar diretamente sem fazer scroll na página atual
      // O ScrollRestoration vai posicionar no topo após a navegação
      navigateWithUtms(localizedPath);
    } catch (error) {
      console.warn('Erro ao navegar para página:', error);
    }
  };
  
  return (
    <footer className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Coluna 1: Logo + Descrição */}
          <div>
            <Logo size={80} className="mb-4" />
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{t('footer.email')}</span>
            </div>
          </div>

              {/* Coluna 2: Links Rápidos */}
              <div>
                <h3 className="font-semibold text-foreground mb-4">{t('footer.quickLinks')}</h3>
                <ul className="space-y-2">
                  <li>
                    <LinkWithUtms
                      to="/"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.home')}
                    </LinkWithUtms>
                  </li>
                  <li>
                    <LinkWithUtms
                      to="/quiz"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('navigation.createMusic')}
                    </LinkWithUtms>
                  </li>
                  <li>
                    <LinkWithUtms
                      to="/#radiola"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.listenExample')}
                    </LinkWithUtms>
                  </li>
                </ul>
              </div>

              {/* Coluna 3: Suporte & Legal */}
              <div>
                <h3 className="font-semibold text-foreground mb-4">{t('footer.support')}</h3>
                <ul className="space-y-2">
                  <li>
                    <LinkWithUtms
                      to="/#faq"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.faq')}
                    </LinkWithUtms>
                  </li>
                  <li>
                    <LinkWithUtms
                      to="/#pricing"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.pricing')}
                    </LinkWithUtms>
                  </li>
                  <li>
                    <LinkWithUtms
                      to="/terms"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.terms')}
                    </LinkWithUtms>
                  </li>
                  <li>
                    <LinkWithUtms
                      to="/privacy"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t('footer.privacy')}
                    </LinkWithUtms>
                  </li>
                </ul>
              </div>

              {/* Coluna 4: Contato */}
              <div>
                <h3 className="font-semibold text-foreground mb-4">{t('footer.contact')}</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{t('footer.email')}</span>
                  </div>
                </div>
              </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-border/50">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} MusicLovely. {t('footer.copyright')}</p>
            <div className="flex items-center gap-1 text-xs">
              <Heart className="h-3 w-3 text-primary" />
              <span>{t('contact.whyChoose.madeWithLove.title')}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
