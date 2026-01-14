import React, { createContext, useContext, ReactNode } from 'react';

type SupportedLocale = 'pt';

interface LocaleContextType {
  locale: SupportedLocale;
  isLoading: boolean;
  changeLocale: (newLocale: SupportedLocale) => void;
  error: string | null;
  redetect: () => void;
  t: (key: string, fallback?: string | Record<string, string | number>) => string;
  translations: Record<string, any>;
  forceLocale: (locale: SupportedLocale) => void;
  isLocaleForced: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'pt',
  isLoading: false,
  changeLocale: () => {},
  error: null,
  redetect: () => {},
  t: (key: string, _fallback?: string | Record<string, string | number>) => {
    if (typeof _fallback === 'string') return _fallback;
    return key;
  },
  translations: {},
  forceLocale: () => {},
  isLocaleForced: false
});

// Hook simplificado - sempre retorna português
export const useLocaleContext = () => {
  return {
    locale: 'pt' as SupportedLocale,
    isLoading: false,
    changeLocale: () => {},
    error: null,
    redetect: () => {},
    t: (key: string, fallback?: string | Record<string, string | number>) => {
      if (typeof fallback === 'string') return fallback;
      return key;
    },
    translations: {},
    forceLocale: (_locale: SupportedLocale) => {},
    isLocaleForced: false
  };
};

// Provider simplificado - sempre português
export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const contextValue: LocaleContextType = {
    locale: 'pt',
    isLoading: false,
    changeLocale: () => {},
    error: null,
    redetect: () => {},
    t: (key: string, fallback?: string | Record<string, string | number>) => {
      if (typeof fallback === 'string') return fallback;
      return key;
    },
    translations: {},
    forceLocale: () => {},
    isLocaleForced: false
  };

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};

export default LocaleContext;
