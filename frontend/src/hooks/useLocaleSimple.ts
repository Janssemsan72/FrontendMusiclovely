import { useState, useEffect } from 'react';

export type Locale = 'pt' | 'es' | 'en';

export function useLocaleSimple() {
  const [locale, setLocale] = useState<Locale>('es');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Verificar cookie/localStorage primeiro (síncrono, sem bloqueio)
    const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1];
    const storedLang = localStorage.getItem('musiclovely_language');
    const immediateLang = (cookieLang || storedLang) as Locale | null;
    
    if (immediateLang && ['pt', 'es', 'en'].includes(immediateLang)) {
      setLocale(immediateLang as Locale);
      setIsLoading(false);
      // ✅ OTIMIZAÇÃO: Adiar detecção de país para depois do PageView (requestIdleCallback)
      const detectCountryAsync = async () => {
        try {
          // Detectar país via IP (apenas para atualizar se necessário)
          let response = await fetch('http://ip-api.com/json/');
          let countryCode = null;
          
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
              countryCode = data.countryCode;
            }
          } else {
            response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
              const data = await response.json();
              countryCode = data.country_code;
            }
          }
          
          if (countryCode) {
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
            
            if (detectedLocale !== immediateLang) {
              setLocale(detectedLocale);
              document.cookie = `lang=${detectedLocale};path=/;max-age=31536000;samesite=lax`;
              localStorage.setItem('musiclovely_language', detectedLocale);
            }
          }
        } catch (error) {
          console.error('❌ [UseLocaleSimple] Erro na detecção assíncrona:', error);
        }
      };
      
      // ✅ OTIMIZAÇÃO: Adiar para requestIdleCallback (após PageView)
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(detectCountryAsync, { timeout: 2000 });
      } else {
        setTimeout(detectCountryAsync, 2000);
      }
      return;
    }

    // ✅ OTIMIZAÇÃO: Se não tem idioma salvo, usar padrão e adiar detecção
    setLocale('es');
    setIsLoading(false);
    
    const detectLocaleAsync = async () => {
      try {
        let response = await fetch('http://ip-api.com/json/');
        let countryCode = null;
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            countryCode = data.countryCode;
          }
        } else {
          response = await fetch('https://ipapi.co/json/');
          if (response.ok) {
            const data = await response.json();
            countryCode = data.country_code;
          }
        }
        
        if (countryCode) {
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
          
          setLocale(detectedLocale);
          document.cookie = `lang=${detectedLocale};path=/;max-age=31536000;samesite=lax`;
          localStorage.setItem('musiclovely_language', detectedLocale);
        }
      } catch (error) {
        console.error('❌ [UseLocaleSimple] Erro:', error);
      }
    };
    
    // ✅ OTIMIZAÇÃO: Adiar para requestIdleCallback (após PageView)
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(detectLocaleAsync, { timeout: 2000 });
    } else {
      setTimeout(detectLocaleAsync, 2000);
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    document.cookie = `lang=${newLocale};path=/;max-age=31536000;samesite=lax`;
  };

  return {
    locale,
    isLoading,
    changeLocale
  };
}



