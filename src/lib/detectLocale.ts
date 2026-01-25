/**
 * Detecção de idioma simplificada - sempre retorna português
 * ✅ CORREÇÃO: Removida toda lógica de detecção por país/IP
 */

export type Locale = 'pt';

const DEFAULT_LOCALE: Locale = 'pt';

/**
 * ✅ CORREÇÃO: Sempre retorna Brasil
 */
export async function getCountryByIP(): Promise<string> {
  return 'BR';
}

/**
 * ✅ CORREÇÃO: Sempre retorna português
 */
export async function detectLocaleSimple(_opts?: {
  cookieLang?: string | null;
  queryLang?: string | null;
  navigatorLang?: string | null;
  acceptLanguage?: string | null;
  countryCode?: string | null;
}): Promise<Locale> {
  return DEFAULT_LOCALE;
}

/**
 * Função para salvar preferência de idioma em cookie
 */
export function saveLocalePreference(_locale: Locale): void {
  try {
    document.cookie = `lang=pt;path=/;max-age=${60*60*24*365};samesite=lax`;
  } catch {
    // Ignorar erro
  }
}

/**
 * Função para ler preferência de idioma do cookie
 */
export function getCookieLocale(): Locale {
  return 'pt';
}

/**
 * ✅ CORREÇÃO: Sempre retorna português
 */
export function getLocaleFromPath(_pathname: string): Locale {
  return 'pt';
}
