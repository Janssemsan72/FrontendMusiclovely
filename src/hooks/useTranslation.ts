// Helper temporário para substituir traduções por texto hardcoded em português
// TODO: Substituir gradualmente por texto hardcoded nos componentes

import ptTranslations from '@/i18n/locales/pt.json';

export function useTranslation() {
  const t = (key: string, fallback?: string | Record<string, string | number>): string => {
    // Se o segundo parâmetro for um objeto, tratar como variáveis de substituição
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      // Tentar buscar no JSON de traduções
      const keys = key.split('.');
      let value: any = ptTranslations;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key;
        }
      }
      
      let result = typeof value === 'string' ? value : key;
      
      // Substituir variáveis
      Object.entries(fallback).forEach(([varKey, varValue]) => {
        result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
      });
      
      return result;
    }
    
    // Se houver fallback string, usar ele
    if (typeof fallback === 'string') return fallback;
    
    // Tentar buscar no JSON de traduções
    const keys = key.split('.');
    let value: any = ptTranslations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Se não encontrar, retornar a chave ou fallback
        return typeof fallback === 'string' ? fallback : key;
      }
    }
    
    return typeof value === 'string' ? value : (typeof fallback === 'string' ? fallback : key);
  };

  return { t };
}
