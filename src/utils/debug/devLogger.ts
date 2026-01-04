/**
 * Utilitário para logs condicionais - apenas em desenvolvimento
 * Evita poluição do console em produção
 */

const isDev = import.meta.env.DEV;
const isVerbose = import.meta.env.VITE_VERBOSE_LOGGING === 'true';
export const isDevVerbose = isDev && isVerbose;

export const devLog = {
  /**
   * Log informativo - apenas em desenvolvimento verbose
   */
  info: (...args: any[]) => {
    if (isDevVerbose) {
      console.log(...args);
    }
  },

  /**
   * Log de warning - apenas em desenvolvimento
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log de erro - sempre mostrar, mas com contexto
   */
  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    } else {
      // Em produção, logar apenas o essencial
      console.error('[Error]', args[0]);
    }
  },

  /**
   * Log de debug - apenas em desenvolvimento verbose
   */
  debug: (...args: any[]) => {
    if (isDevVerbose) {
      console.debug(...args);
    }
  },

  /**
   * Log de sucesso - apenas em desenvolvimento verbose
   */
  success: (...args: any[]) => {
    if (isDevVerbose) {
      console.log(...args);
    }
  },
};

/**
 * Helper para logs de performance - apenas em desenvolvimento verbose
 */
export const perfLog = (label: string, startTime: number) => {
  if (isDevVerbose) {
    const duration = Date.now() - startTime;
    console.log(`⏱️ [Performance] ${label}: ${duration}ms`);
  }
};

/**
 * Helper para logs de tracking - apenas em desenvolvimento verbose
 */
export const trackingLog = (event: string, data?: any) => {
  if (isDevVerbose) {
    console.log(`📊 [Tracking] ${event}`, data || '');
  }
};

/**
 * Helper para logs de tradução - apenas em desenvolvimento verbose
 */
export const i18nLog = (message: string, data?: any) => {
  if (isDevVerbose) {
    console.log(`🌍 [i18n] ${message}`, data || '');
  }
};

/**
 * Helper para logs de áudio/música - apenas em desenvolvimento verbose
 */
export const audioLog = (message: string, data?: any) => {
  if (isDevVerbose) {
    console.log(`🎵 [Audio] ${message}`, data || '');
  }
};

