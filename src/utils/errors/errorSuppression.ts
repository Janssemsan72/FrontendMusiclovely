/**
 * Configuração para suprimir erros conhecidos e não críticos
 * Especialmente útil para erros de tracking em desenvolvimento
 */

const isDev = import.meta.env.DEV;

function isThirdPartyTrackingScript(filenameOrStack: string): boolean {
  const str = (filenameOrStack || '')
    .toLowerCase()
    .split('#')[0]
    .split('?')[0];
  return (
    str.includes('pixel.js') || // UTMify pixel
    str.includes('pixel-tiktok.js') || // UTMify tiktok pixel
    str.includes('utmify') ||
    str.includes('fbevents.js') || // Meta Pixel base script
    str.includes('connect.facebook.net') ||
    str.includes('facebook.net')
  );
}

function isMetaTrafficPermissionError(message: string): boolean {
  const msg = (message || '').toLowerCase();
  return (
    msg.includes('is unavailable on this website') &&
    msg.includes('traffic permission')
  );
}

function isUnexpectedEndOfInputError(message: string): boolean {
  const msg = (message || '').toLowerCase();
  return msg.includes('unexpected end of input');
}

/**
 * Verifica se o erro é relacionado ao UTMify tentando conectar em localhost:3001
 */
function isUtmifyTrackingError(error: any): boolean {
  if (!isDev) return false;
  
  const errorMessage = error?.message || String(error) || '';
  const errorStack = error?.stack || '';
  const errorUrl = error?.url || '';
  
  // Padrões que indicam erro do UTMify tentando conectar em localhost:3001
  const utmifyPatterns = [
    'localhost:3001',
    ':3001/tracking',
    'ERR_CONNECTION_REFUSED',
    'Failed to fetch',
    'NetworkError',
  ];
  
  // Verificar se o erro contém algum dos padrões
  const hasUtmifyPattern = utmifyPatterns.some(pattern => 
    errorMessage.includes(pattern) ||
    errorStack.includes(pattern) ||
    errorUrl.includes(pattern)
  );
  
  // Verificar se é do script pixel.js do UTMify
  const isUtmifyScript = errorStack.includes('pixel.js') || 
                        errorStack.includes('utmify') ||
                        errorUrl.includes('utmify');
  
  return hasUtmifyPattern && (isUtmifyScript || errorUrl.includes('3001'));
}

/**
 * Verifica se é um erro conhecido/ruidoso de scripts de tracking (UTMify/Meta/TikTok)
 * que não deve quebrar a aplicação.
 *
 * ⚠️ Nota: isso não "corrige" a configuração do Meta Pixel (Traffic Permissions),
 * apenas impede que esses erros poluam o console/observabilidade do usuário final.
 */
function isKnownTrackingNoiseError(input: any): boolean {
  const message =
    input?.message ||
    (typeof input === 'string' ? input : '') ||
    '';

  const filename = input?.filename || input?.url || '';
  const isThirdParty = isThirdPartyTrackingScript(filename);

  if (!isThirdParty) return false;

  if (isMetaTrafficPermissionError(message)) return true;

  if (isUnexpectedEndOfInputError(message)) return true;

  return false;
}

export function setupErrorSuppression() {
  // Handler para promises rejeitadas (fetch failures, etc)
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isUtmifyTrackingError(event.reason) || isKnownTrackingNoiseError(event.reason)) {
      if (isDev) {
        console.debug('🔇 [Error Suppression] Suprimindo erro de tracking UTMify em desenvolvimento');
      }
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      } else {
        event.stopPropagation();
      }
      return;
    }
  };
  
  // Handler para erros de rede (fetch, XMLHttpRequest, etc)
  const handleError = (event: ErrorEvent) => {
    // Verificar se é erro de rede relacionado ao UTMify
    if (isUtmifyTrackingError(event.error || event) || isKnownTrackingNoiseError(event.error || event)) {
      if (isDev) {
        console.debug('🔇 [Error Suppression] Suprimindo erro de rede do UTMify em desenvolvimento');
      }
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      } else {
        event.stopPropagation();
      }
      return;
    }
  };
  
  // Interceptar fetch para suprimir erros do UTMify
  let originalFetch: typeof window.fetch | null = null;
  if (isDev && typeof window !== 'undefined') {
    originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0]?.toString() || '';
      
      // Se for requisição para localhost:3001, bloquear antes mesmo de tentar
      if (url.includes('localhost:3001') || url.includes(':3001/tracking')) {
        if (isDev) {
          console.debug('🔇 [Error Suppression] Bloqueando fetch para localhost:3001');
        }
        return new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      
      try {
        return await originalFetch!.apply(this, args);
      } catch (error: any) {
        // Se ainda assim der erro e for do UTMify, suprimir
        if (isUtmifyTrackingError(error)) {
          if (isDev) {
            console.debug('🔇 [Error Suppression] Suprimindo erro de fetch do UTMify');
          }
          return new Response(JSON.stringify({ ok: false }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        throw error;
      }
    };
    
    // Salvar referência para cleanup
    (window as any).__originalFetch = originalFetch;
  }
  
  // Registrar handlers
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleError, true); // Usar capture phase
  
  if (isDev) {
    console.log('✅ [Error Suppression] Sistema de supressão de erros configurado');
  }
  
  // Retornar função de cleanup
  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleError, true);
    
    // Restaurar fetch original se necessário
    if (isDev && typeof window !== 'undefined' && (window as any).__originalFetch) {
      window.fetch = (window as any).__originalFetch;
    }
  };
}
