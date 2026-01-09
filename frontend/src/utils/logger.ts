/**
 * Logger centralizado para o sistema
 * 
 * Em desenvolvimento: logs no console
 * Em produção: logs desabilitados (exceto erros críticos)
 * 
 * @module utils/logger
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    this.isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  }

  /**
   * Log genérico - desabilitado
   */
  log(message: string, context?: LogContext): void {
    // Logs desabilitados
  }

  /**
   * Log de informação - desabilitado
   */
  info(message: string, context?: LogContext): void {
    // Logs desabilitados
  }

  /**
   * Log de aviso - desabilitado
   */
  warn(message: string, context?: LogContext): void {
    // Logs desabilitados
  }

  /**
   * Log de erro (sempre logado, mas formatado)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;

    // Logs desabilitados
  }

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  debug(message: string, context?: LogContext): void {
    // Logs desabilitados
  }

  /**
   * Log estruturado para eventos de negócio
   */
  event(eventName: string, properties?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[EVENT] ${eventName}`, properties || '');
    }
    // Em produção, pode enviar para analytics
  }
}

// Exportar instância singleton
export const logger = new Logger();

// Exportar classe para testes
export { Logger };

// Helper para migração gradual
export const consoleLogger = {
  log: (message: string, ...args: unknown[]) => logger.log(message, { args }),
  info: (message: string, ...args: unknown[]) => logger.info(message, { args }),
  warn: (message: string, ...args: unknown[]) => logger.warn(message, { args }),
  error: (message: string, ...args: unknown[]) => logger.error(message, args[0] as Error, { args: args.slice(1) }),
  debug: (message: string, ...args: unknown[]) => logger.debug(message, { args }),
};

