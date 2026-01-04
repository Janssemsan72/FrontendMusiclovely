import { useCallback } from 'react';
import { devLogOnce, serializeForDedupe } from '@/utils/debug/devLogDedupe';
import { useUtmParams } from './useUtmParams';

/**
 * Hook para tracking de eventos customizados via API UTMify
 * Envia eventos com dados customizados e todos os parâmetros de tracking
 */
export function useUtmifyTracking() {
  // Mantemos a leitura dos params para garantir que o hook continue “plugado” no fluxo do funil
  // (útil caso volte tracking ativo via API no futuro).
  const { allTrackingParams: _allTrackingParams } = useUtmParams();

  /**
   * Verifica se está em ambiente de produção
   */
  const isProduction = useCallback(() => {
    const hostname = window.location.hostname;
    // ⚠️ IMPORTANTE: .com.br também é produção (alias da Vercel)
    // Evita logs barulhentos em produção no domínio BR.
    return (
      hostname === 'musiclovely.com' ||
      hostname === 'www.musiclovely.com' ||
      hostname === 'musiclovely.com.br' ||
      hostname === 'www.musiclovely.com.br' ||
      hostname.endsWith('.vercel.app')
    );
  }, []);

  /**
   * Envia evento customizado para API UTMify
   * @param eventName - Nome do evento (ex: 'quiz_completed', 'payment_initiated')
   * @param eventData - Dados adicionais do evento (opcional)
   */
  const trackEvent = useCallback(
    async (eventName: string, eventData?: Record<string, any>) => {
      // NOTA IMPORTANTE: O UTMify já faz tracking automático via scripts carregados no index.html
      // Este código de API direta foi desabilitado porque:
      // 1. A API UTMify retorna 403 (Forbidden) para requisições diretas
      // 2. O tracking principal já funciona automaticamente via scripts UTMify
      // 3. Não é necessário fazer requisições manuais - os scripts já capturam tudo
      
      // Apenas logar em desenvolvimento para debug.
      // Em dev com StrictMode, alguns efeitos rodam 2x: fazemos dedupe para não poluir o console.
      if (!isProduction()) {
        const pathname = window.location?.pathname || '';
        const signature = `${eventName}|${pathname}|${serializeForDedupe(eventData)}`;
        devLogOnce(signature, () => {
          console.log(
            `[UTMify Tracking] Evento ${eventName} (tracking automático via scripts UTMify)`,
            eventData
          );
        });
      }

      // Não fazer requisições manuais - o UTMify já faz tracking automático
        return;
    },
    [isProduction]
  );

  return {
    trackEvent,
    isProduction: isProduction(),
  };
}
