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
  // 1. Verificar prefixo na URL (MAIOR PRIORIDADE)
  const currentPath = window.location.pathname;
  
  if (currentPath.startsWith('/pt')) return 'pt';
  if (currentPath.startsWith('/en')) return 'en';
  if (currentPath.startsWith('/es')) return 'es';
  
  // 2. Verificar localStorage
  const storedLang = localStorage.getItem('musiclovely_language');
  if (storedLang && SUPPORTED_LOCALES.includes(storedLang as SupportedLocale)) {
    return storedLang as SupportedLocale;
  }
  
  // 3. Verificar cookie
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('lang='));
  if (cookie) {
    const lang = cookie.split('=')[1].trim();
    if (SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
      return lang as SupportedLocale;
    }
  }
  
  // 4. Verificar navegador
  const navLang = navigator.language?.slice(0, 2);
  if (navLang && SUPPORTED_LOCALES.includes(navLang as SupportedLocale)) {
    return navLang as SupportedLocale;
  }
  
  // 5. Fallback
  return DEFAULT_LOCALE;
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
  void locale;
  // Remover barra final se existir
  const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;

  const withoutPrefix = cleanPath.replace(/^\/(pt|en|es)(?=\/|$)/, '') || '/';
  return withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
}

/**
 * Verifica se um locale é suportado
 */
export function isValidLocale(locale: string | null | undefined): locale is SupportedLocale {
  return !!locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { SupportedLocale };

