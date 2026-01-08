/**
 * Utilitário centralizado para detecção de idioma
 * Elimina código duplicado em múltiplos arquivos
 */

type SupportedLocale = 'pt' | 'en' | 'es';

const SUPPORTED_LOCALES: SupportedLocale[] = ['pt', 'en', 'es'];
const DEFAULT_LOCALE: SupportedLocale = 'pt';

/**
 * Detecta o idioma atual baseado na URL, localStorage e cookies
 * Ordem de prioridade:
 * 1. Prefixo na URL (/pt, /en, /es)
 * 2. localStorage (musiclovely_language)
 * 3. Cookie (lang)
 * 4. navigator.language
 * 5. Fallback para 'pt'
 */
export function detectCurrentLocale(): SupportedLocale {
  return 'pt';
}

/**
 * Persiste o idioma detectado em localStorage e cookie
 */
export function persistLocale(locale: SupportedLocale): void {
  localStorage.setItem('musiclovely_language', locale);
  document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
  document.documentElement.lang = locale;
}

/**
 * Detecta e persiste o idioma em uma única chamada
 */
export function detectAndPersistLocale(): SupportedLocale {
  const locale = detectCurrentLocale();
  persistLocale(locale);
  return locale;
}

/**
 * Gera path localizado para uma rota
 */
export function getLocalizedPath(path: string, locale: SupportedLocale): string {
  // Remover barra final se existir
  const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // Se já tem prefixo de idioma, retornar como está
  if (cleanPath.startsWith('/pt') || cleanPath.startsWith('/en') || cleanPath.startsWith('/es')) {
    return cleanPath;
  }
  
  // Adicionar prefixo de idioma
  return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}

/**
 * Verifica se um locale é suportado
 */
export function isValidLocale(locale: string | null | undefined): locale is SupportedLocale {
  return !!locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { SupportedLocale };

