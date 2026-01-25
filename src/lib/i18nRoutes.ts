import type { Locale } from './detectLocale';

const SUPPORTED_LOCALES: Locale[] = ['pt'];

/**
 * Extrai o locale da URL atual
 */
export function getCurrentLocale(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && SUPPORTED_LOCALES.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  
  return null;
}

/**
 * Gera um caminho localizado com prefixo de idioma
 * ✅ CORREÇÃO: Site é apenas português, então sempre retorna caminho sem prefixo
 */
export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove prefixo de idioma existente se houver
  const cleanPath = path.replace(/^\/(pt)/, '') || '/';
  
  // ✅ CORREÇÃO: Site é apenas português, não adicionar prefixo
  // Retornar caminho limpo sem prefixo de idioma
  return cleanPath === '/' ? '/' : cleanPath;
}

/**
 * Remove o prefixo de idioma de um caminho
 */
export function removeLocalePrefix(path: string): string {
  return path.replace(/^\/(pt)/, '') || '/';
}

/**
 * Troca o idioma na URL atual
 * ✅ CORREÇÃO: Site é apenas português, então sempre retorna caminho sem prefixo
 */
export function switchLocale(currentPath: string, newLocale: Locale): string {
  const pathWithoutLocale = removeLocalePrefix(currentPath);
  // ✅ CORREÇÃO: Site é apenas português, não adicionar prefixo
  return getLocalizedPath(pathWithoutLocale, newLocale);
}

/**
 * Verifica se um caminho tem prefixo de idioma
 */
export function hasLocalePrefix(path: string): boolean {
  return /^\/(pt)/.test(path);
}

/**
 * Obtém o caminho base sem locale para comparação
 */
export function getBasePath(path: string): string {
  return removeLocalePrefix(path);
}
