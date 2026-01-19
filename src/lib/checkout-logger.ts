/**
 * Utilitário de Logging Detalhado para Checkout
 * 
 * Sistema de logging estruturado para rastrear eventos do fluxo de checkout.
 * Armazena logs em memória e pode salvar no localStorage ou enviar para banco de dados.
 * 
 * @module lib/checkout-logger
 */

export interface CheckoutLogEvent {
  type: 'checkout_started' | 'quiz_creation_started' | 'quiz_created' | 'order_creation_started' | 'order_created' | 'checkout_requested' | 'checkout_received' | 'redirect' | 'redirect_direct' | 'error';
  timestamp: string;
  transactionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

class CheckoutLogger {
  private logs: CheckoutLogEvent[] = [];
  private transactionId: string;

  constructor(transactionId: string) {
    this.transactionId = transactionId;
  }

  /**
   * Registra um evento de checkout
   * 
   * Em desenvolvimento: logs no console com formatação colorida
   * Em produção: apenas erros são logados
   * 
   * @param type - Tipo do evento
   * @param data - Dados do evento (opcional)
   * @param error - Mensagem de erro (opcional)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(type: CheckoutLogEvent['type'], data?: any, error?: string) {
    const event: CheckoutLogEvent = {
      type,
      timestamp: new Date().toISOString(),
      transactionId: this.transactionId,
      data,
      error
    };

    this.logs.push(event);
    
    // Log apenas em desenvolvimento (Vite remove em produção automaticamente)
    if (import.meta.env.DEV) {
      const prefix = `[CHECKOUT ${this.transactionId.slice(0, 8)}]`;
      switch (type) {
        case 'error':
          console.error(prefix, type, error || data);
          break;
        case 'quiz_created':
        case 'order_created':
        case 'checkout_received':
          console.log(`✅ ${prefix}`, type, data);
          break;
        default:
          console.log(prefix, type, data);
      }
    }
  }

  /**
   * Retorna todos os logs registrados
   * 
   * @returns Array com todos os eventos de log registrados
   */
  getLogs(): CheckoutLogEvent[] {
    return this.logs;
  }

  /**
   * Retorna o ID da transação
   * 
   * @returns UUID da transação de checkout
   */
  getTransactionId(): string {
    return this.transactionId;
  }

  /**
   * Salva logs no localStorage para debug
   * 
   * Útil para debug em desenvolvimento. Os logs são salvos com a chave
   * `checkout_logs_{transactionId}`.
   */
  saveToDraft() {
    try {
      localStorage.setItem(`checkout_logs_${this.transactionId}`, JSON.stringify(this.logs));
    } catch (error) {
      // Log removido
    }
  }

  /**
   * Envia logs para o banco de dados
   * 
   * Insere os eventos de log na tabela `checkout_events` do Supabase.
   * Útil para monitoramento e análise de problemas em produção.
   * 
   * @param supabaseClient - Cliente Supabase autenticado
   * @param orderId - ID do pedido associado (opcional)
   * 
   * @example
   * ```ts
   * const logger = createCheckoutLogger();
   * logger.log('checkout_started', { plan: 'standard' });
   * await logger.sendToDatabase(supabase, orderId);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendToDatabase(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabaseClient: any, 
    orderId?: string
  ) {
    try {
      const events = this.logs.map(log => ({
        transaction_id: this.transactionId,
        order_id: orderId || null,
        event_type: log.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: log.data || {},
        error: log.error || null
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const { error } = await supabaseClient
        .from('checkout_events')
        .insert(events);

      if (error) {
        // Log removido
      }
    } catch (error) {
      // Log removido
    }
  }
}

/**
 * Cria uma nova instância de CheckoutLogger
 * 
 * Gera um UUID único para a transação e retorna uma nova instância do logger.
 * 
 * @returns Nova instância de CheckoutLogger com transactionId único
 * 
 * @example
 * ```ts
 * const logger = createCheckoutLogger();
 * logger.log('checkout_started', { plan: 'standard' });
 * ```
 */
export function createCheckoutLogger(): CheckoutLogger {
  // Gerar UUID único para esta transação
  // Usar crypto.randomUUID se disponível, senão usar fallback
  let transactionId: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    transactionId = crypto.randomUUID();
  } else {
    // Fallback para navegadores que não suportam crypto.randomUUID
    transactionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  return new CheckoutLogger(transactionId);
}

/**
 * Carrega um CheckoutLogger existente com um transactionId específico
 * 
 * Útil para continuar logging de uma transação existente após recarregar a página
 * ou restaurar de localStorage.
 * 
 * @param transactionId - UUID da transação existente
 * @returns Instância de CheckoutLogger com o transactionId fornecido
 * 
 * @example
 * ```ts
 * const savedTransactionId = localStorage.getItem('current_transaction_id');
 * if (savedTransactionId) {
 *   const logger = loadCheckoutLogger(savedTransactionId);
 *   logger.log('page_reloaded');
 * }
 * ```
 */
export function loadCheckoutLogger(transactionId: string): CheckoutLogger {
  return new CheckoutLogger(transactionId);
}
