// Sistema de detecção de idioma para localhost e produção sem dependências externas
// Site apenas em português

export type SupportedLocale = 'pt';

const SUPPORTED_LOCALES: SupportedLocale[] = ['pt'];
const DEFAULT_LOCALE: SupportedLocale = 'pt';

export function detectFromUrl(pathname: string): SupportedLocale | null {
	const segments = pathname.split('/').filter(Boolean);
	const first = segments[0];
	if (first && (SUPPORTED_LOCALES as string[]).includes(first)) {
		return first as SupportedLocale;
	}
	return null;
}

export function detectFromNavigator(): SupportedLocale | null {
	try {
		const lang = (navigator?.language || '').toLowerCase();
		if (!lang) return null;
		if (lang.startsWith('pt')) return 'pt';
		return null;
	} catch {
		return null;
	}
}

// Para SSR/edge futuro: permite passar cabeçalhos já resolvidos pelo provedor
export function detectFromCountryHeader(countryHeader?: string | null): SupportedLocale | null {
	void countryHeader;
	return DEFAULT_LOCALE;
}

export function detectLanguage(pathname: string, countryHeader?: string | null): SupportedLocale {
	void pathname;
	void countryHeader;
	return 'pt';
}


