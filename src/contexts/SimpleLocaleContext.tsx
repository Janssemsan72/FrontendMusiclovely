import React, { createContext, useContext, ReactNode } from 'react';

// ✅ CORREÇÃO: Importar apenas traduções em português
import ptTranslations from '@/i18n/locales/pt.json';

// ✅ CORREÇÃO: Tipo simplificado - apenas português
type Locale = 'pt';

interface SimpleLocaleContextType {
  locale: Locale;
  isLoading: boolean;
  changeLocale: (newLocale: Locale) => void;
  t: (key: string) => string;
}

const SimpleLocaleContext = createContext<SimpleLocaleContextType>({
  locale: 'pt',
  isLoading: false,
  changeLocale: () => {},
  t: (key: string) => key
});

export const useSimpleLocaleContext = () => useContext(SimpleLocaleContext);

export const SimpleLocaleProvider = ({ children }: { children: ReactNode }) => {
  // ✅ CORREÇÃO: Sempre português, sem detecção, sem loading
  const locale: Locale = 'pt';
  const isLoading = false;
  const changeLocale = (_newLocale: Locale) => {
    // Não faz nada - sempre português
  };

  // ✅ CORREÇÃO: Sempre usar traduções em português
  const translations = ptTranslations;

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



