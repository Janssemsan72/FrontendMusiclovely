/**
 * Hook simplificado de locale - sempre retorna português
 * Sem detecção de país/IP para garantir experiência consistente
 */

export type Locale = 'pt';

export function useLocaleSimple() {
  // ✅ CORREÇÃO: Sempre português, sem detecção, sem loading
  const locale: Locale = 'pt';
  const isLoading = false;

  const changeLocale = (_newLocale: Locale) => {
    // Não faz nada - sempre português
  };

  return {
    locale,
    isLoading,
    changeLocale
  };
}



