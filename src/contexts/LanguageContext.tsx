import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { detectLanguage, type SupportedLocale } from '@/lib/language-detection';

interface LanguageContextType {
  language: SupportedLocale;
  loading: boolean;
  changeLanguage: (lang: SupportedLocale) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  loading: false,
  changeLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();

  const initialLanguage = useMemo(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    return detectLanguage(pathname);
  }, []);

  const changeLanguage = (newLang: SupportedLocale) => {
    try {
      if (i18n) {
        i18n.changeLanguage(newLang);
      }
      // Sem persistência em cookie/localStorage. Navegação deve ser tratada pelo roteador.
      console.log('🌍 Idioma alterado para:', newLang);
    } catch (error) {
      console.error('Erro ao alterar idioma:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{
      language: (() => {
        const raw = i18n?.language;
        const normalized = raw ? raw.split('-')[0] : null;
        if (normalized === 'pt' || normalized === 'en' || normalized === 'es') return normalized;
        return initialLanguage;
      })(),
      loading: false,
      changeLanguage,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
