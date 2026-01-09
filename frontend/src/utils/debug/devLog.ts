/**
 * Utilitário para logs de desenvolvimento
 * Logs são exibidos apenas em desenvolvimento, exceto erros críticos
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  /**
   * Log geral - desabilitado
   */
  log: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Debug - desabilitado
   */
  debug: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Warning - desabilitado
   */
  warn: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Error - desabilitado
   */
  error: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Info - desabilitado
   */
  info: (...args: any[]) => {
    // Logs desabilitados
  },

  /**
   * Group - desabilitado
   */
  group: (label: string) => {
    // Logs desabilitados
  },

  /**
   * GroupEnd - desabilitado
   */
  groupEnd: () => {
    // Logs desabilitados
  },

  /**
   * Table - desabilitado
   */
  table: (data: any) => {
    // Logs desabilitados
  }
};

// Export default também para compatibilidade
export default devLog;

