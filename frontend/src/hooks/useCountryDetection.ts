import { useState, useEffect } from 'react';

export type Country = 'BR' | 'PT' | 'ES' | 'MX' | 'AR' | 'CO' | 'CL' | 'PE' | 'VE' | 'EC' | 'GT' | 'CU' | 'BO' | 'DO' | 'HN' | 'PY' | 'SV' | 'NI' | 'CR' | 'PA' | 'UY' | 'GQ' | 'PR' | 'AO' | 'MZ' | 'CV' | 'GW' | 'ST' | 'TL' | 'MO' | 'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IT' | 'NL' | 'SE' | 'NO' | 'DK' | 'FI' | 'PL' | 'CZ' | 'HU' | 'RO' | 'BG' | 'HR' | 'SI' | 'SK' | 'EE' | 'LV' | 'LT' | 'MT' | 'CY' | 'LU' | 'IE' | 'AT' | 'BE' | 'CH' | 'LI' | 'IS' | 'AD' | 'MC' | 'SM' | 'VA' | 'AL' | 'BA' | 'ME' | 'MK' | 'RS' | 'XK' | 'MD' | 'UA' | 'BY' | 'RU' | 'TR' | 'GR' | 'OTHER';

export type Language = 'pt' | 'es' | 'en';

// Países lusófonos (ISO-3166 alpha-2)
const PT_COUNTRIES = new Set([
  'BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'MO'
]);

// Principais países hispânicos
const ES_COUNTRIES = new Set([
  'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ', 'PR'
]);

// Principais países anglófonos
const EN_COUNTRIES = new Set([
  'US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA', 'NG', 'KE', 'GH', 'UG', 'TZ', 'ZW', 'ZM', 'BW', 'LS', 'SZ', 'MW', 'JM', 'BB', 'TT', 'GY', 'BZ', 'AG', 'BS', 'DM', 'GD', 'KN', 'LC', 'VC', 'SG', 'MY', 'PH', 'IN', 'PK', 'BD', 'LK', 'MM', 'FJ', 'PG', 'SB', 'VU', 'TO', 'WS', 'KI', 'TV', 'NR', 'PW', 'FM', 'MH', 'CK', 'NU', 'TK', 'NF'
]);

export function countryToLanguage(country: Country): Language {
  if (PT_COUNTRIES.has(country)) return 'pt';
  if (ES_COUNTRIES.has(country)) return 'es';
  if (EN_COUNTRIES.has(country)) return 'en';
  return 'en'; // Default to English for unknown countries
}

export function useCountryDetection() {
  const [country, setCountry] = useState<Country | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [lastDetection, setLastDetection] = useState<number>(0);

  const detectCountry = async (forceRefresh = false) => {
    // Evitar detecções muito frequentes (máximo a cada 30 segundos)
    const now = Date.now();
    if (!forceRefresh && now - lastDetection < 30000) {
      return;
    }

    const timestamp = Date.now();
    setIsLoading(true);
    setLastDetection(now);

    try {
      // Adicionar timestamp para evitar cache
      // Tentar primeiro com ip-api.com (HTTP)
      let response = await fetch(`http://ip-api.com/json/?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      let data = null;
      let countryCode = null;
      
      if (response.ok) {
        data = await response.json();
        if (data.status === 'success' && data.countryCode) {
          countryCode = data.countryCode;
          console.log('🌍 [CountryDetection] País detectado via ip-api.com:', countryCode);
        }
      }
      
      // Se não funcionou, tentar fallback com ipapi.co
      if (!countryCode) {
        console.log('🌍 [CountryDetection] Tentando fallback com ipapi.co...');
        response = await fetch(`https://ipapi.co/json/?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (response.ok) {
          data = await response.json();
          if (data.country_code) {
            countryCode = data.country_code;
            console.log('🌍 [CountryDetection] País detectado via ipapi.co:', countryCode);
          }
        }
      }
      
      if (countryCode) {
        const detectedCountry = countryCode as Country;
        const detectedLanguage = countryToLanguage(detectedCountry);
        
        console.log('🌍 [CountryDetection] País detectado:', detectedCountry, '→ Idioma:', detectedLanguage);
        
        setCountry(detectedCountry);
        setLanguage(detectedLanguage);
        
        // Salvar no localStorage para persistência
        localStorage.setItem('detectedCountry', detectedCountry);
        localStorage.setItem('detectedLanguage', detectedLanguage);
        localStorage.setItem('lastDetection', now.toString());
      } else {
        throw new Error('No country code received from any API');
      }
    } catch (error) {
      console.warn('⚠️ [CountryDetection] Erro na detecção, tentando fallback:', error);
      
      // Tentar fallback com ip-api.com
      try {
        const fallbackResponse = await fetch(`http://ip-api.com/json/?t=${timestamp}`, {
          cache: 'no-cache'
        });
        
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          if (data.countryCode) {
            const detectedCountry = data.countryCode as Country;
            const detectedLanguage = countryToLanguage(detectedCountry);
            
            console.log('🌍 [CountryDetection] País detectado (fallback):', detectedCountry, '→ Idioma:', detectedLanguage);
            
            setCountry(detectedCountry);
            setLanguage(detectedLanguage);
            
            localStorage.setItem('detectedCountry', detectedCountry);
            localStorage.setItem('detectedLanguage', detectedLanguage);
            localStorage.setItem('lastDetection', now.toString());
            return;
          }
        }
      } catch (fallbackError) {
        console.warn('⚠️ [CountryDetection] Fallback também falhou:', fallbackError);
      }
      
      // Último fallback: idioma do navegador
      const browserLang = navigator.language.split('-')[0];
      let fallbackLanguage: Language = 'en';
      
      if (browserLang === 'pt') {
        fallbackLanguage = 'pt';
      } else if (browserLang === 'es') {
        fallbackLanguage = 'es';
      }
      
      console.log('🌍 [CountryDetection] Usando idioma do navegador:', fallbackLanguage);
      setLanguage(fallbackLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Verificar se há detecção recente no localStorage
    const lastDetection = localStorage.getItem('lastDetection');
    const storedCountry = localStorage.getItem('detectedCountry');
    const storedLanguage = localStorage.getItem('detectedLanguage');
    
    if (lastDetection && storedCountry && storedLanguage) {
      const timeSinceLastDetection = Date.now() - parseInt(lastDetection);
      
      // Se a detecção foi feita há menos de 5 minutos, usar dados salvos
      if (timeSinceLastDetection < 300000) {
        console.log('🌍 [CountryDetection] Usando dados salvos:', storedCountry, '→', storedLanguage);
        setCountry(storedCountry as Country);
        setLanguage(storedLanguage as Language);
        setIsLoading(false);
        return;
      }
    }
    
    // Detectar país
    detectCountry();
  }, []);

  // Adicionar listener para mudanças de visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Página ficou visível novamente, re-detectar
        console.log('🌍 [CountryDetection] Página visível, re-detectando...');
        detectCountry(true);
      }
    };

    const handleFocus = () => {
      // Página recebeu foco, re-detectar
      console.log('🌍 [CountryDetection] Página com foco, re-detectando...');
      detectCountry(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const clearCache = () => {
    localStorage.removeItem('detectedCountry');
    localStorage.removeItem('detectedLanguage');
    localStorage.removeItem('lastDetection');
    localStorage.removeItem('lastIPDetection');
    localStorage.removeItem('detectedIP');
    setCountry(null);
    setLanguage('en');
    setLastDetection(0);
    console.log('🗑️ [CountryDetection] Cache limpo');
  };

  const forceDetect = async () => {
    clearCache();
    await detectCountry(true);
  };

  const overrideCountry = (newCountry: Country) => {
    const newLanguage = countryToLanguage(newCountry);
    setCountry(newCountry);
    setLanguage(newLanguage);
    localStorage.setItem('detectedCountry', newCountry);
    localStorage.setItem('detectedLanguage', newLanguage);
    localStorage.setItem('lastDetection', Date.now().toString());
    localStorage.setItem('countryOverride', 'true');
    console.log('🎯 [CountryDetection] Override ativo:', newCountry, '→', newLanguage);
  };

  return {
    country,
    language,
    isLoading,
    setLanguage,
    redetect: () => detectCountry(true),
    clearCache,
    forceDetect,
    overrideCountry
  };
}
