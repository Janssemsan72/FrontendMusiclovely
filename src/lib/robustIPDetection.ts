import { i18nLog, devLog } from '@/utils/debug/devLogger';

export type Locale = 'pt' | 'es' | 'en';

interface IPDetectionResult {
  countryCode: string | null;
  countryName: string | null;
  source: string;
}

interface IPAPIResponse {
  country_code?: string;
  country_name?: string;
  country?: string;
  countryCode?: string;
  status?: string;
}

/**
 * Sistema robusto de detecção de IP com múltiplas APIs e fallbacks
 */
export class RobustIPDetection {
  private static readonly APIS = [
    {
      name: 'ip-api.com',
      url: 'http://ip-api.com/json/',
      parser: (data: any): IPDetectionResult => ({
        countryCode: data.countryCode,
        countryName: data.country,
        source: 'ip-api.com'
      })
    },
    {
      name: 'ipapi.co',
      url: 'https://ipapi.co/json/',
      parser: (data: any): IPDetectionResult => ({
        countryCode: data.country_code,
        countryName: data.country_name,
        source: 'ipapi.co'
      })
    },
    {
      name: 'ipinfo.io',
      url: 'https://ipinfo.io/json',
      parser: (data: any): IPDetectionResult => ({
        countryCode: data.country,
        countryName: data.country,
        source: 'ipinfo.io'
      })
    }
  ];

  /**
   * Detecta o país usando múltiplas APIs com fallback
   */
  static async detectCountry(): Promise<IPDetectionResult | null> {
    i18nLog('RobustIPDetection: iniciando detecção robusta de país...');
    
    for (const api of this.APIS) {
      try {
        i18nLog('RobustIPDetection: tentando API', api.name);
        
        const response = await fetch(api.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Timeout de 5 segundos
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          const result = api.parser(data);
          
          if (result.countryCode) {
            i18nLog('RobustIPDetection: sucesso', { api: api.name, result });
            return result;
          }
        } else {
          devLog.warn(`⚠️ [RobustIPDetection] API ${api.name} retornou status`, response.status);
        }
      } catch (error) {
        devLog.warn(`⚠️ [RobustIPDetection] Erro na API ${api.name}`, error);
        continue;
      }
    }
    
    devLog.warn('⚠️ [RobustIPDetection] Todas as APIs falharam');
    return null;
  }

  /**
   * Mapeia código do país para idioma
   */
  static mapCountryToLocale(countryCode: string): Locale {
    const PT_COUNTRIES = new Set(['BR','PT','AO','MZ','CV','GW','ST','TL','MO']);
    const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR']);
    const EN_COUNTRIES = new Set(['US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF']);
    
    const code = countryCode.toUpperCase();
    
    if (PT_COUNTRIES.has(code)) return 'pt';
    if (ES_COUNTRIES.has(code)) return 'es';
    if (EN_COUNTRIES.has(code)) return 'en';
    
    // Fallback para inglês se país não mapeado
    return 'en';
  }

  /**
   * Detecta idioma com prioridades: localStorage > cookie > navigator > IP > default
   */
  static async detectLocale(): Promise<Locale> {
    i18nLog('RobustIPDetection: iniciando detecção robusta de idioma...');
    
    // 1. Verificar localStorage
    const storedLang = localStorage.getItem('musiclovely_language');
    if (storedLang && ['pt', 'es', 'en'].includes(storedLang)) {
      i18nLog('RobustIPDetection: usando idioma do localStorage', storedLang);
      return storedLang as Locale;
    }
    
    // 2. Verificar cookie
    const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
    if (cookieLang && ['pt', 'es', 'en'].includes(cookieLang)) {
      i18nLog('RobustIPDetection: usando idioma do cookie', cookieLang);
      return cookieLang as Locale;
    }
    
    // 3. Verificar navigator.language
    const navigatorLang = navigator.language.toLowerCase();
    if (navigatorLang.includes('pt')) {
      i18nLog('RobustIPDetection: usando idioma do navigator', 'pt');
      return 'pt';
    } else if (navigatorLang.includes('es')) {
      i18nLog('RobustIPDetection: usando idioma do navigator', 'es');
      return 'es';
    } else if (navigatorLang.includes('en')) {
      i18nLog('RobustIPDetection: usando idioma do navigator', 'en');
      return 'en';
    }
    
    // 4. Detectar por IP
    try {
      const ipResult = await this.detectCountry();
      if (ipResult?.countryCode) {
        const detectedLocale = this.mapCountryToLocale(ipResult.countryCode);
        i18nLog('RobustIPDetection: idioma detectado por IP', { detectedLocale, countryCode: ipResult.countryCode });
        return detectedLocale;
      }
    } catch (error) {
      devLog.warn('⚠️ [RobustIPDetection] Erro na detecção por IP', error);
    }
    
    // 5. Fallback para português
    i18nLog('RobustIPDetection: usando idioma padrão', 'pt');
    return 'pt';
  }

  /**
   * Salva preferência de idioma
   */
  static saveLocalePreference(locale: Locale): void {
    try {
      localStorage.setItem('musiclovely_language', locale);
      document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
      i18nLog('RobustIPDetection: preferência salva', locale);
    } catch (error) {
      devLog.warn('⚠️ [RobustIPDetection] Erro ao salvar preferência', error);
    }
  }
}

export default RobustIPDetection;
