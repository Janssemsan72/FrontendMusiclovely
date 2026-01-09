import React, { createContext, useContext, ReactNode } from 'react';
import { useLocaleSimple, type Locale } from '@/hooks/useLocaleSimple';

// Importar traduções
// ✅ CORREÇÃO VERCEL: Usar import direto (Vite suporta importação de JSON nativamente)
import ptTranslations from '@/i18n/locales/pt.json';
import esTranslations from '@/i18n/locales/es_new.json';
import enTranslations from '@/i18n/locales/en_new.json';

interface SimpleLocaleContextType {
  locale: Locale;
  isLoading: boolean;
  changeLocale: (newLocale: Locale) => void;
  t: (key: string) => string;
}

const SimpleLocaleContext = createContext<SimpleLocaleContextType>({
  locale: 'es',
  isLoading: true,
  changeLocale: () => {},
  t: (key: string) => key
});

export const useSimpleLocaleContext = () => useContext(SimpleLocaleContext);

export const SimpleLocaleProvider = ({ children }: { children: ReactNode }) => {
  const { locale, isLoading, changeLocale } = useLocaleSimple();

  // Obter traduções baseado no idioma
  const getTranslations = () => {
    switch (locale) {
      case 'pt':
        return ptTranslations;
      case 'en':
        return enTranslations;
      case 'es':
      default:
        return esTranslations;
    }
  };

  const translations = getTranslations();

  // Função de tradução
  const t = (key: string): string => {
    try {
      const keys = key.split('.');
      let value: any = translations;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key;
        }
      }
      
      return typeof value === 'string' ? value : key;
    } catch (err) {
      return key;
    }
  };

  console.log('🌍 [SimpleLocaleProvider] Renderizando com locale:', locale, 'isLoading:', isLoading);

  return (
    <SimpleLocaleContext.Provider value={{
      locale,
      isLoading,
      changeLocale,
      t
    }}>
      {children}
    </SimpleLocaleContext.Provider>
  );
};



