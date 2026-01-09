// Mapear país para região comercial (sempre Brasil)
export function mapCountryToRegion(country: string): string {
  // Projeto apenas para Brasil, sempre retorna 'brasil'
  return 'brasil';
}

// Mapear país para idioma (sempre português)
export function mapCountryToLanguage(country: string): string {
  // Projeto apenas para Brasil, sempre retorna 'pt'
  return 'pt';
}

// Verificar se dois países estão na mesma região
export function isSameRegion(country1: string, country2: string): boolean {
  const region1 = mapCountryToRegion(country1);
  const region2 = mapCountryToRegion(country2);
  return region1 === region2;
}

// Obter flag do país
export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    'BR': '🇧🇷',
    'US': '🇺🇸',
    'ES': '🇪🇸',
    'MX': '🇲🇽',
    'AR': '🇦🇷',
    'CO': '🇨🇴',
    'CL': '🇨🇱',
    'PE': '🇵🇪',
    'OTHER': '🌍'
  };
  return flags[country] || '🌍';
}

// Obter nome da região (sempre Brasil)
export function getRegionName(region: string): string {
  return 'Brasil';
}

// Hash do IP para privacidade
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'musiclovely_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar session token
export function validateSessionToken(token: string): boolean {
  // Verificar se o token tem o formato correto (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

// Verificar se a sessão expirou
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
