/**
 * Detector de idioma simplificado - apenas português
 * Site é apenas em português, então sempre retorna 'pt'
 */

export type SupportedLanguage = 'pt';

/**
 * Detecta o idioma de um pedido - sempre retorna 'pt' (apenas português)
 */
export async function detectLanguageFromOrder(
  supabase: any,
  orderId: string
): Promise<SupportedLanguage> {
  console.log(`🌍 [LanguageDetector] Idioma para pedido ${orderId}: pt (apenas português)`);
  return 'pt';
}

