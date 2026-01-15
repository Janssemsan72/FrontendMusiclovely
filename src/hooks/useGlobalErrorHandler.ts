import { useEffect } from "react";

/**
 * Hook para tratamento global de erros no admin
 * Filtra erros de código minificado, bibliotecas externas e recursos do navegador
 */
export function useGlobalErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Filtrar erros de código minificado (VM*.js) ou bibliotecas externas
      const errorSource = event.filename || '';
      const errorMessage = event.message || '';
      
      // Verificar se é erro de código minificado (VM*.js) ou bibliotecas externas
      const isMinifiedCode = errorSource.includes('VM') || 
                            errorSource.includes('js.js') ||
                            errorSource.includes('eval') ||
                            errorSource.includes('Function');
      
      // Verificar se é erro de biblioteca externa conhecida
      const isExternalLibraryError = errorSource.includes('utmify') ||
                                    errorMessage.includes('Cannot read properties of undefined') ||
                                    errorMessage.includes('reading \'forEach\'');
      
      // Filtrar erros de recursos do navegador (não são erros críticos do código)
      const isResourceError = errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') ||
                             errorMessage.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                             errorMessage.includes('ERR_NETWORK_CHANGED') ||
                             errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                             errorMessage.includes('Failed to load resource') ||
                             (errorSource.includes('.mp3') && errorMessage.includes('Failed'));
      
      // Suprimir erros de código minificado, bibliotecas externas e recursos do navegador
      if (isMinifiedCode || isExternalLibraryError || isResourceError) {
        event.preventDefault(); // Suprimir o erro
        return;
      }
      
      // Logar outros erros normalmente
      console.error('Erro capturado:', event.error);
    };

    window.addEventListener('error', handleError, true); // Usar capture phase
    return () => window.removeEventListener('error', handleError, true);
  }, []);
}
