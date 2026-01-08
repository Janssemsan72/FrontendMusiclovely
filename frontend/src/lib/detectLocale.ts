import { i18nLog, devLog } from '@/utils/debug/devLogger';

export type Locale = 'pt' | 'es' | 'en';

const SUPPORTED: Locale[] = ['pt', 'es', 'en'];
const DEFAULT_LOCALE: Locale = 'pt';

const PT_COUNTRIES = new Set(['BR','PT','AO','MZ','CV','GW','ST','TL','MO']);
const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR']);
const EN_COUNTRIES = new Set(['US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF']);

function mapCountryToLocale(country?: string): Locale | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (PT_COUNTRIES.has(c)) return 'pt';
  if (ES_COUNTRIES.has(c)) return 'es';
  if (EN_COUNTRIES.has(c)) return 'en';
  return null;
}

function fromAcceptLanguage(accept?: string): Locale | null {
  if (!accept) return null;
  const a = accept.toLowerCase();
  if (a.includes('pt')) return 'pt';
  if (a.includes('es')) return 'es';
  if (a.includes('en')) return 'en';
  return null;
}

function normalize(lang?: string): Locale | null {
  if (!lang) return null;
  const base = lang.slice(0,2).toLowerCase() as Locale;
  return SUPPORTED.includes(base) ? base : null;
}

/**
 * Detecta o país do usuário via API ipapi.co (gratuita)
 */
export async function getCountryByIP(): Promise<string | null> {
  try {
    // Tentar primeiro com ip-api.com (HTTP)
    let response = await fetch('http://ip-api.com/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.countryCode) {
        i18nLog('DetectLocale: país via ip-api.com', data.countryCode);
        return data.countryCode;
      }
    }
    
    // Fallback para ipapi.co (HTTPS)
    i18nLog('DetectLocale: tentando fallback ipapi.co...');
    response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      i18nLog('DetectLocale: país via ipapi.co', data.country_code);
      return data.country_code || null;
    }
    
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    devLog.warn('⚠️ [DetectLocale] Erro ao detectar país por IP', error);
    return null;
  }
}

/**
 * Detecta o locale com prioridades: cookie > query > geolocalização > navigator > default
 */
export async function detectLocaleSimple(opts: {
  cookieLang?: string | null;       // ex.: valor do cookie "lang"
  queryLang?: string | null;        // ex.: ?lang=pt
  navigatorLang?: string | null;    // ex.: navigator.language no client
  acceptLanguage?: string | null;   // ex.: req.headers['accept-language'] no server
  countryCode?: string | null;      // ex.: código ISO do país (BR/US/ES)
}): Promise<Locale> {
  i18nLog('DetectLocale: iniciando detecção', opts);

  // 1. Cookie (preferência salva)
  const cookieResult = normalize(opts.cookieLang);
  if (cookieResult) {
    i18nLog('DetectLocale: usando idioma do cookie', cookieResult);
    return cookieResult;
  }

  // 2. Query string
  const queryResult = normalize(opts.queryLang);
  if (queryResult) {
    i18nLog('DetectLocale: usando idioma da query', queryResult);
    return queryResult;
  }

  // 3. Geolocalização por IP (mais confiável para detecção automática)
  if (opts.countryCode) {
    const geoResult = mapCountryToLocale(opts.countryCode);
    if (geoResult) {
      i18nLog('DetectLocale: usando idioma por país fornecido', { geoResult, countryCode: opts.countryCode });
      return geoResult;
    }
  }

  // 4. Idioma do navegador (fallback)
  const navigatorResult = normalize(opts.navigatorLang || undefined) ?? fromAcceptLanguage(opts.acceptLanguage || undefined);
  if (navigatorResult) {
    i18nLog('DetectLocale: usando idioma do navegador', navigatorResult);
    return navigatorResult;
  }

  // 5. Fallback para português (padrão do sistema)
  i18nLog('DetectLocale: usando idioma padrão', DEFAULT_LOCALE);
  return DEFAULT_LOCALE;
}

/**
 * Função para salvar preferência de idioma em cookie
 */
export function saveLocalePreference(locale: Locale): void {
  try {
    document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
    i18nLog('DetectLocale: preferência salva', locale);
  } catch (error) {
    devLog.warn('⚠️ [DetectLocale] Erro ao salvar preferência', error);
  }
}

/**
 * Função para ler preferência de idioma do cookie
 */
export function getCookieLocale(): string | null {
  try {
    const match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    return match ? match[1] : null;
  } catch (error) {
    devLog.warn('⚠️ [DetectLocale] Erro ao ler cookie', error);
    return null;
  }
}

/**
 * Extrai o locale da URL (pathname)
 */
export function getLocaleFromPath(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && SUPPORTED.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  
  return null;
}
