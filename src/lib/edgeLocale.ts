/**
 * Detecção de idioma simplificada - sempre retorna português
 * ✅ CORREÇÃO: Removida toda lógica de detecção por país/IP
 */

export type EdgeLocaleResponse = {
  language: 'pt';
  country: string | null;
  ip?: string | null;
  source?: string;
  error?: string;
};

/**
 * ✅ CORREÇÃO: Sempre retorna português imediatamente
 * Sem chamadas de rede, sem detecção de país
 */
export async function detectLocaleAtEdge(_signal?: AbortSignal): Promise<EdgeLocaleResponse> {
  return {
    language: 'pt',
    country: 'BR',
    source: 'fixed',
  };
}

export function normalizeSimpleLocale(_lang?: string | null): 'pt' {
  return 'pt';
}


