/**
 * Cliente API para comunicação com o backend (Railway)
 * Substitui chamadas diretas às Edge Functions do Supabase
 */

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_RAILWAY_URL || 'http://localhost:3000';

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  details?: any;
}

interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
}

class ApiClient {
  private baseUrl: string;
  private healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
  private readonly HEALTH_CHECK_CACHE_TTL = 30000; // 30 segundos

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Log da URL configurada (apenas em dev)
    if (import.meta.env.DEV) {
      console.log(`🔗 [ApiClient] Backend URL: ${this.baseUrl}`);
    }
  }

  /**
   * Verifica se o backend Railway está online
   */
  async healthCheck(): Promise<boolean> {
    // Usar cache para evitar muitas requisições
    const now = Date.now();
    if (this.healthCheckCache && (now - this.healthCheckCache.timestamp) < this.HEALTH_CHECK_CACHE_TTL) {
      return this.healthCheckCache.isHealthy;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
      });

      const isHealthy = response.ok;
      this.healthCheckCache = {
        isHealthy,
        timestamp: now,
      };

      if (!isHealthy && import.meta.env.DEV) {
        console.warn(`⚠️ [ApiClient] Backend Railway não está respondendo corretamente (status: ${response.status})`);
      }

      return isHealthy;
    } catch (error: any) {
      const isHealthy = false;
      this.healthCheckCache = {
        isHealthy,
        timestamp: now,
      };

      if (import.meta.env.DEV) {
        console.warn(`⚠️ [ApiClient] Erro ao verificar health do backend Railway:`, error.message);
      }

      return isHealthy;
    }
  }

  /**
   * Faz uma requisição com retry automático para operações críticas
   */
  private async requestWithRetry<T = any>(
    endpoint: string,
    options?: RequestInit,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error: any) {
        lastError = error;
        
        // Não fazer retry para erros 4xx (erros do cliente)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Se não for a última tentativa, aguardar antes de tentar novamente
        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          if (import.meta.env.DEV) {
            console.log(`🔄 [ApiClient] Tentativa ${attempt + 1}/${maxRetries} falhou, tentando novamente em ${delay}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async request<T = any>(
    endpoint: string,
    options?: RequestInit,
    useRetry: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Se retry estiver habilitado, usar método com retry
    if (useRetry) {
      return this.requestWithRetry<T>(endpoint, options);
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: AbortSignal.timeout(30000), // Timeout de 30 segundos
      });

      if (!response.ok) {
        let errorData: ApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: `API Error: ${response.statusText}`,
            message: `HTTP ${response.status}`,
          };
        }
        
        const error = new Error(errorData.message || errorData.error || 'Unknown error') as any;
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return response.json();
    } catch (error: any) {
      // Log mais detalhado em desenvolvimento
      if (import.meta.env.DEV) {
        console.error(`❌ [ApiClient] Erro ao chamar ${endpoint}:`, {
          message: error.message,
          status: error.status,
          url,
        });
      }

      // Se for erro de rede, logar aviso
      if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn(`⚠️ [ApiClient] Erro de rede ao chamar Railway (${endpoint}). Verifique se VITE_API_URL está configurada corretamente.`);
      }
      
      throw error;
    }
  }

  get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, data?: any, useRetry: boolean = false): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }, useRetry);
  }

  put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);

// Exportar função de health check
export const checkRailwayHealth = () => api.healthCheck();

// Métodos helper específicos para o MusicLovely
export const apiHelpers = {
  // Checkout
  createCheckout: (data: {
    session_id: string;
    quiz: any;
    customer_email: string;
    customer_whatsapp: string;
    plan: 'standard' | 'express';
    amount_cents: number;
    provider: 'cakto';
    transaction_id?: string;
  }) => api.post<{ success: boolean; quiz_id?: string; order_id?: string; log_id?: string; error?: string; message?: string }>(
    '/api/checkout/create',
    data
  ),

  // Geração de letras (com retry automático)
  generateLyrics: (data: { order_id: string }) => 
    api.post<{ success: boolean; job_id?: string; lyrics?: any; error?: string }>(
      '/api/lyrics/generate',
      data,
      true // usar retry
    ),

  // Geração de áudio (com retry automático)
  generateAudio: (data: { job_id: string }) => 
    api.post<{ success: boolean; task_id?: string; error?: string }>(
      '/api/audio/generate',
      data,
      true // usar retry
    ),

  // Callback do Suno (geralmente chamado pelo próprio Suno, não pelo frontend)
  sunoCallback: (data: any) => 
    api.post<{ success: boolean; songsCreated?: number; error?: string }>(
      '/api/suno/callback',
      data
    ),
};
