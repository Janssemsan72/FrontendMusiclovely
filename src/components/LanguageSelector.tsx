import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { switchLocale } from '@/lib/i18nRoutes';

type Language = 'pt';

const languages = [
  { code: 'pt', name: 'Português', flag: '🇧🇷', native: 'Português' },
];

export default function LanguageSelector() {
  const { i18n, isLoading } = useTranslation();
  const { locale } = useLocaleContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];

  const handleLanguageChange = (languageCode: Language) => {
    // Verificar se estamos em uma página de checkout
    const currentPath = location.pathname;
    const isCheckoutPage = currentPath.includes('/checkout');
    
    // ✅ PROTEÇÃO: Avisar usuário se estiver no checkout com dados preenchidos
    if (isCheckoutPage && typeof window !== 'undefined') {
      const hasEmail = sessionStorage.getItem('checkout_email') || document.querySelector<HTMLInputElement>('input[type="email"]')?.value;
      const hasWhatsapp = sessionStorage.getItem('checkout_whatsapp') || document.querySelector<HTMLInputElement>('input[type="tel"]')?.value;
      
      if (hasEmail || hasWhatsapp) {
        const confirmChange = window.confirm(
          'Trocar o idioma irá recarregar a página do checkout. Os dados do formulário serão preservados. Deseja continuar?'
        );
        
        if (!confirmChange) {
          return; // Usuário cancelou
        }
        
        // Salvar dados antes de trocar idioma
        const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
        const whatsappInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
        
        if (emailInput?.value) sessionStorage.setItem('checkout_email', emailInput.value);
        if (whatsappInput?.value) sessionStorage.setItem('checkout_whatsapp', whatsappInput.value);
      }
    }
    
    // Troca o idioma no contexto
    i18n.changeLanguage(languageCode);
    
    // Atualiza a URL com o novo prefixo de idioma
    // Preservar query params e hash
    const search = location.search;
    const hash = location.hash;
    
    let newPath: string;
    
    if (isCheckoutPage) {
      // Se estamos no checkout, redirecionar para o checkout no idioma selecionado
      newPath = `/${languageCode}/checkout`;
      console.log('🛒 [LanguageSelector] Redirecionando para checkout no idioma:', languageCode);
    } else {
      // Para outras páginas, usar a lógica normal de troca de idioma
      newPath = switchLocale(currentPath, languageCode);
    }
    
    // Adicionar query params e hash preservados
    const finalPath = `${newPath}${search}${hash}`;
    
    console.log('🌍 [LanguageSelector] Trocando idioma:', languageCode);
    console.log('🌍 [LanguageSelector] Caminho atual:', currentPath);
    console.log('🌍 [LanguageSelector] Novo caminho:', finalPath);
    console.log('🌍 [LanguageSelector] É página de checkout:', isCheckoutPage);
    
    navigate(finalPath);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="gap-2 border-background/30 text-background hover:bg-background/10 hover:text-background hover:border-background/50 transition-colors text-base font-medium px-4 py-2.5 h-auto"
          disabled={isLoading}
        >
          <Globe className="h-5 w-5" />
          <span className="hidden sm:inline">{currentLanguage.native}</span>
          <span className="sm:hidden">{currentLanguage.flag}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code as Language)}
            className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <span className="text-lg">{language.flag}</span>
            <div className="flex-1">
              <div className="font-medium">{language.native}</div>
              <div className="text-xs text-muted-foreground">{language.name}</div>
            </div>
            {locale === language.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
