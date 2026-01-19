/**
 * Tipos compartilhados do Checkout
 */

export interface StripeCheckoutResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
  message?: string;
  plan?: string;
  priceId?: string;
}

export interface QuizData {
  id?: string;
  about_who: string;
  relationship?: string;
  style: string;
  language: string;
  vocal_gender?: string | null;
  qualities?: string;
  memories?: string;
  message?: string;
  occasion?: string;
  desired_tone?: string;
  key_moments?: string | null;
  answers?: Record<string, unknown>;
  timestamp?: string;
  whatsapp?: string;
  session_id?: string;
}

export interface CheckoutDraft {
  email: string;
  whatsapp: string;
  planId: string;
  quizData: QuizData;
  transactionId: string;
  timestamp: number;
}

export type PlanId = 'standard' | 'express';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  currency: 'BRL';
  delivery: string;
  featured: boolean;
  badge?: string;
  features: string[];
}
