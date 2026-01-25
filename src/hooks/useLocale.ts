/**
 * Hook simplificado de locale - sempre retorna português
 * ✅ CORREÇÃO: Removida toda lógica de detecção por IP
 */

export type Locale = 'pt';

export interface UseLocaleReturn {
  locale: Locale;
  isLoading: boolean;
  changeLocale: (newLocale: Locale) => void;
  error: string | null;
  redetect: () => void;
}

export function useLocale(): UseLocaleReturn {
  // ✅ CORREÇÃO: Sempre português, sem detecção
  return {
    locale: 'pt',
    isLoading: false,
    changeLocale: (_newLocale: Locale) => {},
    error: null,
    redetect: () => {}
  };
}