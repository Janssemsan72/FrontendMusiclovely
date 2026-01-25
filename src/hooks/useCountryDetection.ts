/**
 * Hook simplificado de detecção de país - sempre retorna Brasil/Português
 * ✅ CORREÇÃO: Removida toda lógica de detecção por IP
 */

export type Country = 'BR';
export type Language = 'pt';

export function countryToLanguage(_country: Country): Language {
  return 'pt';
}

export function useCountryDetection() {
  // ✅ CORREÇÃO: Sempre Brasil/Português, sem detecção
  const country: Country = 'BR';
  const language: Language = 'pt';
  const isLoading = false;

  const clearCache = () => {
    // Não faz nada
  };

  const forceDetect = async () => {
    // Não faz nada
  };

  const overrideCountry = (_newCountry: Country) => {
    // Não faz nada
  };

  const setLanguage = (_lang: Language) => {
    // Não faz nada
  };

  return {
    country,
    language,
    isLoading,
    setLanguage,
    redetect: () => {},
    clearCache,
    forceDetect,
    overrideCountry
  };
}
