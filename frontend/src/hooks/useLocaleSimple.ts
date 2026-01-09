import { useState, useEffect } from 'react';

export type Locale = 'pt' | 'es' | 'en';

export function useLocaleSimple() {
  const [locale, setLocale] = useState<Locale>('es');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectLocale = async () => {
      console.log('🌍 [UseLocaleSimple] Iniciando detecção...');
      
      try {
        // Verificar cookie primeiro
        const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1];
        if (cookieLang && ['pt', 'es', 'en'].includes(cookieLang)) {
          console.log('🌍 [UseLocaleSimple] Usando cookie:', cookieLang);
          setLocale(cookieLang as Locale);
          setIsLoading(false);
          return;
        }

        // Detectar país via IP
        console.log('🌍 [UseLocaleSimple] Detectando país...');
        
        // Tentar primeiro com ip-api.com (HTTP)
        let response = await fetch('http://ip-api.com/json/');
        let countryCode = null;
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            countryCode = data.countryCode;
            console.log('🌍 [UseLocaleSimple] País detectado via ip-api.com:', countryCode);
          }
        } else {
          // Fallback para ipapi.co (HTTPS)
          console.log('🌍 [UseLocaleSimple] Tentando fallback com ipapi.co...');
          response = await fetch('https://ipapi.co/json/');
          if (response.ok) {
            const data = await response.json();
            countryCode = data.country_code;
            console.log('🌍 [UseLocaleSimple] País detectado via ipapi.co:', countryCode);
          }
        }
        
        if (countryCode) {
          // Mapear país para idioma
          const ptCountries = ['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'MO'];
          const esCountries = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ', 'PR'];
          
          let detectedLocale: Locale = 'es';
          if (ptCountries.includes(countryCode)) {
            detectedLocale = 'pt';
          } else if (esCountries.includes(countryCode)) {
            detectedLocale = 'es';
          } else {
            detectedLocale = 'en';
          }
          
          console.log('🌍 [UseLocaleSimple] Idioma detectado:', detectedLocale);
          setLocale(detectedLocale);
          
          // Salvar cookie
          document.cookie = `lang=${detectedLocale};path=/;max-age=31536000;samesite=lax`;
        }
      } catch (error) {
        console.error('❌ [UseLocaleSimple] Erro:', error);
        setLocale('es');
      } finally {
        setIsLoading(false);
      }
    };

    detectLocale();
  }, []);

  const changeLocale = (newLocale: Locale) => {
    console.log('🌍 [UseLocaleSimple] Mudando idioma para:', newLocale);
    setLocale(newLocale);
    document.cookie = `lang=${newLocale};path=/;max-age=31536000;samesite=lax`;
  };

  return {
    locale,
    isLoading,
    changeLocale
  };
}



