/**
 * Sistema simplificado de detecção de idioma - sempre retorna português
 * ✅ CORREÇÃO: Removida toda lógica de detecção por IP
 */

export type Locale = 'pt';

interface IPDetectionResult {
  countryCode: string;
  countryName: string;
  source: string;
}

export class RobustIPDetection {
  /**
   * ✅ CORREÇÃO: Sempre retorna Brasil
   */
  static async detectCountry(): Promise<IPDetectionResult> {
    return {
      countryCode: 'BR',
      countryName: 'Brasil',
      source: 'fixed'
    };
  }

  /**
   * ✅ CORREÇÃO: Sempre retorna português
   */
  static mapCountryToLocale(_countryCode: string): Locale {
    return 'pt';
  }

  /**
   * ✅ CORREÇÃO: Sempre retorna português
   */
  static async detectLocale(): Promise<Locale> {
    return 'pt';
  }

  /**
   * Salva preferência de idioma (sempre português)
   */
  static saveLocalePreference(_locale: Locale): void {
    try {
      localStorage.setItem('musiclovely_language', 'pt');
      document.cookie = `lang=pt;path=/;max-age=${60*60*24*365};samesite=lax`;
    } catch {
      // Ignorar erro
    }
  }
}

export default RobustIPDetection;
