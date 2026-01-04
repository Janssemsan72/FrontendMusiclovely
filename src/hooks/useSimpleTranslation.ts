import { useSimpleLocaleContext } from '@/contexts/SimpleLocaleContext';

export const useSimpleTranslation = () => {
  const { t, locale, changeLocale, isLoading } = useSimpleLocaleContext();

  return {
    t,
    locale,
    changeLocale,
    isLoading,
    i18n: {
      language: locale,
      changeLanguage: changeLocale,
      dir: () => 'ltr'
    }
  };
};



