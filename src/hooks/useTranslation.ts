// Helper temporário para substituir traduções por texto hardcoded em português
// TODO: Substituir gradualmente por texto hardcoded nos componentes

import ptTranslations from '@/i18n/locales/pt.json';

export function useTranslation() {
  const t = (key: string, fallback?: string): string => {
    // Se houver fallback, usar ele
    if (fallback) return fallback;
    
    // Tentar buscar no JSON de traduções
    const keys = key.split('.');
    let value: any = ptTranslations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Se não encontrar, retornar a chave ou fallback
        return fallback || key;
      }
    }
    
    return typeof value === 'string' ? value : (fallback || key);
  };

  return { t };
}
