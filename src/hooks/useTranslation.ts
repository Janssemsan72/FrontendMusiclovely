import { useTranslation as useI18nTranslation } from 'react-i18next';
import i18n from '@/i18n';

/**
 * Hook para tradução - apenas português
 * Mantém compatibilidade com código existente
 */
export const useTranslation = () => {
  // Garantir que i18n está inicializado e em português
  if (!i18n.isInitialized) {
    i18n.changeLanguage('pt').catch(() => {
      // Ignorar erro se já estiver inicializado
    });
  } else if (i18n.language !== 'pt') {
    i18n.changeLanguage('pt');
  }
  
  const { t } = useI18nTranslation();

  return {
    t,
    locale: 'pt' as const,
    i18n: {
      language: 'pt' as const,
      changeLanguage: (_language?: string) => {},
      dir: () => 'ltr'
    },
    currentLanguage: 'pt' as const,
    isRTL: false,
    isLoading: false,
    error: null,
    redetect: () => {} // Não faz nada
  };
};
