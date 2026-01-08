/**
 * Cliente API para comunicação com o backend (Railway)
 * Substitui chamadas diretas às Edge Functions do Supabase
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T = any>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
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
  }) => api.post<{ success: boolean; quiz_id: string; order_id: string; log_id?: string }>(
    '/api/checkout/create',
    data
  ),

  // Geração de letras
  generateLyrics: (data: any) => api.post('/api/lyrics/generate', data),

  // Geração de áudio
  generateAudio: (data: any) => api.post('/api/audio/generate', data),

  // Callback do Suno
  sunoCallback: (data: any) => api.post('/api/suno/callback', data),
};

