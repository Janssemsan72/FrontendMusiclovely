/**
 * Utilitário para logs de desenvolvimento
 * Logs são exibidos apenas em desenvolvimento, exceto erros críticos
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  /**
   * Log geral - apenas em desenvolvimento
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Debug - apenas em desenvolvimento
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Warning - apenas em desenvolvimento
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Error - SEMPRE logado (crítico para debugging em produção)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info - apenas em desenvolvimento
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Group - apenas em desenvolvimento
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * GroupEnd - apenas em desenvolvimento
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Table - apenas em desenvolvimento
   */
  table: (data: any) => {
    if (isDev) {
      console.table(data);
    }
  }
};

// Export default também para compatibilidade
export default devLog;

