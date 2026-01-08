import { useCallback, useEffect, useState } from 'react';
import { devLogOnce, serializeForDedupe } from '@/utils/debug/devLogDedupe';
import { useUtmParams } from './useUtmParams';

/**
 * Hook para tracking de eventos customizados via API UTMify
 * Envia eventos com dados customizados e todos os parâmetros de tracking
 */
export function useUtmifyTracking() {
  // Mantemos a leitura dos params para garantir que o hook continue "plugado" no fluxo do funil
  const { allTrackingParams: _allTrackingParams } = useUtmParams();
  const [utmifyReady, setUtmifyReady] = useState(false);

  /**
   * Verifica se UTMify está carregado e pronto
   */
  const checkUtmifyReady = useCallback(() => {
    // Verificar múltiplas formas de detectar UTMify
    const hasUtmify = typeof (window as any).utmify !== 'undefined';
    const hasPixel = typeof (window as any).pixel !== 'undefined';
    const hasPixelId = typeof (window as any).pixelId !== 'undefined';
    const hasUtmifyScript = document.querySelector('script[src*="utmify"]') !== null || 
                            document.querySelector('script[src*="utms/latest.js"]') !== null;
    const hasPixelScript = document.querySelector('script[src*="pixel.js"]') !== null;
    
    // Verificar se scripts foram carregados (mesmo que APIs não estejam disponíveis ainda)
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const hasUtmifyScripts = scripts.some(s => 
      (s as HTMLScriptElement).src.includes('utmify') || 
      (s as HTMLScriptElement).src.includes('pixel.js')
    );
    
    const ready = hasUtmify || hasPixel || hasPixelId || hasUtmifyScript || hasPixelScript || hasUtmifyScripts;
    
    return ready;
  }, []);

  /**
   * Processa eventos pendentes salvos no localStorage
   */
  const processPendingEvents = useCallback(() => {
    try {
      const pendingEvents = JSON.parse(localStorage.getItem('utmify_pending_events') || '[]');
      if (pendingEvents.length === 0) return;

      // Disparar eventos pendentes
      pendingEvents.forEach((event: any) => {
        const customEvent = new CustomEvent('utmify:track', {
          detail: { eventName: event.eventName, eventData: event.eventData },
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(customEvent);
      });

      // Limpar eventos processados
      localStorage.removeItem('utmify_pending_events');
    } catch (error) {
      // Erro silencioso ao processar eventos pendentes
    }
  }, []);

  /**
   * Aguarda UTMify estar pronto (com timeout)
   */
  const waitForUtmify = useCallback(async (maxWait = 10000): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      if (checkUtmifyReady()) {
        setUtmifyReady(true);
        processPendingEvents();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }, [checkUtmifyReady, processPendingEvents]);

  // Verificar se UTMify está pronto quando o componente monta
  useEffect(() => {
    // Verificar imediatamente
    if (checkUtmifyReady()) {
      setUtmifyReady(true);
      // Processar eventos pendentes
      processPendingEvents();
    }

    // Escutar evento customizado quando UTMify ficar pronto
    const handleUtmifyReady = () => {
      setUtmifyReady(true);
      processPendingEvents();
    };
    
    window.addEventListener('utmify:ready', handleUtmifyReady);

    // Aguardar carregamento do script
    const checkInterval = setInterval(() => {
      if (checkUtmifyReady()) {
        setUtmifyReady(true);
        clearInterval(checkInterval);
        // Processar eventos pendentes quando UTMify ficar pronto
        processPendingEvents();
      }
    }, 200);

    // Timeout de 15 segundos (aumentado para dar mais tempo)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
    }, 15000);

    return () => {
      window.removeEventListener('utmify:ready', handleUtmifyReady);
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [checkUtmifyReady, processPendingEvents]);

  /**
   * Verifica se está em ambiente de produção
   */
  const isProduction = useCallback(() => {
    const hostname = window.location.hostname;
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
      // Se UTMify não está pronto, aguardar (com timeout)
      if (!utmifyReady) {
        const ready = await waitForUtmify(5000);
        if (!ready) {
          // Continuar mesmo se UTMify não estiver pronto
        }
      }
      
      // Verificar novamente se UTMify está disponível
      const utmifyLoaded = typeof (window as any).utmify !== 'undefined';
      const pixelLoaded = typeof (window as any).pixel !== 'undefined';
      
      // ✅ ESTRATÉGIA HÍBRIDA: UTMify detecta eventos automaticamente via scripts
      // Para eventos customizados, usar múltiplas abordagens:
      
      // 1. Tentar via API UTMify se disponível
      if (utmifyLoaded && (window as any).utmify?.track) {
        try {
          (window as any).utmify.track(eventName, eventData);
        } catch (error) {
          // Erro silencioso ao disparar via utmify.track
        }
      }
      
      // 2. Disparar evento customizado via dispatchEvent (UTMify pode escutar)
      try {
        const customEvent = new CustomEvent('utmify:track', {
          detail: { eventName, eventData },
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(customEvent);
      } catch (error) {
        // Erro silencioso ao disparar evento customizado
      }
      
      // 3. Salvar evento no localStorage para processamento posterior (se UTMify não estiver pronto)
      if (!utmifyReady && !utmifyLoaded && !pixelLoaded) {
        try {
          const pendingEvents = JSON.parse(localStorage.getItem('utmify_pending_events') || '[]');
          pendingEvents.push({
            eventName,
            eventData,
            timestamp: Date.now(),
            pathname: window.location.pathname
          });
          // Manter apenas últimos 10 eventos
          if (pendingEvents.length > 10) {
            pendingEvents.shift();
          }
          localStorage.setItem('utmify_pending_events', JSON.stringify(pendingEvents));
        } catch (error) {
          // Erro silencioso ao salvar evento no localStorage
        }
      }
      
      // Apenas logar em desenvolvimento para debug.
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

      return;
    },
    [isProduction, utmifyReady, waitForUtmify]
  );

  return {
    trackEvent,
    isProduction: isProduction(),
    utmifyReady,
  };
}
