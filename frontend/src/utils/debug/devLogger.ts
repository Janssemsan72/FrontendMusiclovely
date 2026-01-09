/**
 * Utilitário para logs condicionais - apenas em desenvolvimento
 * Evita poluição do console em produção
 */

const isDev = import.meta.env.DEV;
const isVerbose = import.meta.env.VITE_VERBOSE_LOGGING === 'true';
export const isDevVerbose = isDev && isVerbose;

export const devLog = {
  /**
   * Log informativo - desabilitado
   */
  info: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Log de warning - desabilitado
   */
  warn: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Log de erro - desabilitado
   */
  error: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Log de debug - desabilitado
   */
  debug: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Log de sucesso - desabilitado
   */
  success: (...args: any[]) => {
    // Logs desabilitados
  },
};

export function agentLog(payload: Record<string, unknown>) {
  if (!isDev) return;
  if (import.meta.env.VITE_AGENT_LOGGING !== 'true') return;

  const endpoint = import.meta.env.VITE_AGENT_LOG_ENDPOINT;
  if (!endpoint) return;

  try {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    return;
  }
}

/**
 * Helper para logs de performance - desabilitado
 */
export const perfLog = (label: string, startTime: number) => {
  // Logs desabilitados
};

/**
 * Helper para logs de tracking - desabilitado
 */
export const trackingLog = (event: string, data?: any) => {
  // Logs desabilitados
};

/**
 * Helper para logs de tradução - desabilitado
 */
export const i18nLog = (message: string, data?: any) => {
  // Logs desabilitados
};

/**
 * Helper para logs de áudio/música - desabilitado
 */
export const audioLog = (message: string, data?: any) => {
  // Logs desabilitados
};

