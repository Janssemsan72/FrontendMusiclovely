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

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async request<T = any>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
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
        throw new Error(errorData.message || errorData.error || 'Unknown error');
      }

      return response.json();
    } catch (error: any) {
      // Se for erro de rede, tentar fallback para Supabase Edge Functions
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn(`⚠️ [ApiClient] Erro de rede ao chamar Railway, usando fallback para Supabase Edge Functions`);
        throw error; // Deixar o erro propagar para que o código possa usar fallback
      }
      throw error;
    }
  }

  get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  // Geração de letras
  generateLyrics: (data: { order_id: string }) => 
    api.post<{ success: boolean; job_id?: string; lyrics?: any; error?: string }>(
      '/api/lyrics/generate',
      data
    ),

  // Geração de áudio
  generateAudio: (data: { job_id: string }) => 
    api.post<{ success: boolean; task_id?: string; error?: string }>(
      '/api/audio/generate',
      data
    ),

  // Callback do Suno (geralmente chamado pelo próprio Suno, não pelo frontend)
  sunoCallback: (data: any) => 
    api.post<{ success: boolean; songsCreated?: number; error?: string }>(
      '/api/suno/callback',
      data
    ),
};
