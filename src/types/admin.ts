// Tipos base para dados de música
export interface Song {
  id: string;
  title: string;
  variant_number: number;
  cover_url?: string;
  audio_url?: string;
  status: SongStatus;
  release_at?: string;
  email_sent?: boolean;
  order_id: string;
  created_at: string;
  updated_at: string;
  orders: Order;
  style?: string;
  download_url?: string;
  vocals_url?: string;
  instrumental_url?: string;
  stems_separated_at?: string;
}

// Status possíveis para músicas
export type SongStatus = 'ready' | 'approved' | 'released' | 'rejected' | 'pending';

// Interface para pedidos
export interface Order {
  id: string;
  customer_email: string;
  plan: PlanType;
  magic_token: string;
  user_id: string;
  created_at: string;
  quizzes: Quiz;
}

// Tipos de planos
export type PlanType = 'express' | 'standard';

// Interface para quiz
export interface Quiz {
  about_who: string;
  style: string;
  desired_tone?: string;
  music_prompt?: string;
}

// Interface para grupos de músicas (gerações)
export interface SongGroup {
  id: string;
  songs: Song[];
  about: string;
  email: string;
  plan: PlanType;
  magic_token: string;
  created_at: string;
  customer_name?: string;
}

// Interface para logs de email
export interface EmailLog {
  id: string;
  song_id: string;
  email_type: EmailType;
  status: EmailStatus;
  sent_at: string;
  error_message?: string;
}

// Tipos de email
export type EmailType = 'music_released' | 'order_paid' | 'lyrics_approved' | 'test';

// Status de email
export type EmailStatus = 'sent' | 'failed' | 'pending';

// Interface para aprovações de letras
export interface LyricsApproval {
  id: string;
  order_id: string;
  job_id: string;
  quiz_id: string;
  lyrics: any;
  lyrics_preview: string;
  status: LyricsStatus;
  expires_at: string;
  created_at: string;
  rejection_reason?: string;
  regeneration_count: number;
  approval_token: string;
  voice?: 'M' | 'F' | 'S'; // M = Masculino, F = Feminino, S = Sem preferência
  is_highlighted?: boolean; // Destacar letra
  orders: {
    customer_email: string;
    plan?: string;
  };
  quizzes: Quiz & {
    vocal_gender?: string;
  };
  // ✅ NOVO: Informações sobre músicas criadas para este pedido
  has_songs?: boolean;
  songs_count?: number;
  songs?: Array<{
    id: string;
    order_id: string;
    status: string;
    audio_url: string;
    created_at: string;
  }>;
}

// Status de letras
export type LyricsStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Interface para templates de email
export interface EmailTemplate {
  id: string;
  template_type: EmailType;
  subject: string;
  content: string;
  language: string;
  created_at: string;
  updated_at: string;
}

// Interface para ações de admin
export interface AdminAction {
  type: 'approve' | 'reject' | 'release' | 'regenerate';
  targetId: string;
  data?: any;
}

// Interface para configurações de agrupamento
export interface GroupingOptions {
  status?: SongStatus[];
  includeEmailLogs?: boolean;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
  groupSize?: number;
}

// Interface para resultados de operações
export interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Interface para configurações de UI
export interface UIConfig {
  compact?: boolean;
  showPlayer?: boolean;
  showActions?: boolean;
  showEmailStatus?: boolean;
  cardSize?: 'small' | 'medium' | 'large';
}

// Enums para constantes
export enum AdminPages {
  RELEASES = 'releases',
  LYRICS = 'lyrics',
  EMAILS = 'emails',
  SONGS = 'songs'
}

export enum ActionTypes {
  APPROVE_FOR_22H = 'approve_for_22h',
  RELEASE_NOW = 'release_now',
  REJECT_LYRICS = 'reject_lyrics',
  REGENERATE_LYRICS = 'regenerate_lyrics'
}

// Tipos para props de componentes
export interface SongCardProps {
  song: Song;
  compact?: boolean;
  showPlayer?: boolean;
  showActions?: boolean;
  onApprove?: () => void;
  onRelease?: () => void;
  processing?: boolean;
  className?: string;
}

export interface SongGroupCardProps {
  group: SongGroup;
  onApprove?: (groupId: string) => void;
  onRelease?: (groupId: string) => void;
  processing?: boolean;
  className?: string;
}

// ==========================================
// TIPOS FINANCEIROS
// ==========================================

export type FinancialCategoryType = 'fixed_cost' | 'variable_cost' | 'revenue' | 'marketing' | 'operational' | 'api_cost';
export type CostFrequency = 'monthly' | 'yearly' | 'weekly' | 'daily';
export type RefundStatus = 'pending' | 'completed' | 'failed';
export type SaleStatus = 'pending' | 'paid' | 'cancelled';
export type AdjustmentStatus = 'pending' | 'paid' | 'cancelled';

export interface FinancialCategory {
  id: string;
  name: string;
  type: FinancialCategoryType;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FixedCost {
  id: string;
  category_id?: string;
  name: string;
  amount_cents: number;
  frequency: CostFrequency;
  month?: number;
  year: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
}

export interface VariableCost {
  id: string;
  category_id?: string;
  name: string;
  amount_cents: number;
  date: string;
  description?: string;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
}

export interface ApiCost {
  id: string;
  provider: string;
  amount_cents: number;
  credits_used?: number;
  date: string;
  description?: string;
  job_id?: string;
  order_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  order_id: string;
  amount_cents: number;
  reason?: string;
  refund_date: string;
  status: RefundStatus;
  provider: string;
  transaction_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  orders?: Order;
}

export interface PixSale {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_whatsapp?: string;
  amount_cents: number;
  sale_date: string;
  payment_date?: string;
  status: SaleStatus;
  order_id?: string;
  notes?: string;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  orders?: Order;
}

export interface Adjustment {
  id: string;
  order_id: string;
  amount_cents: number;
  description?: string;
  adjustment_date: string;
  status: AdjustmentStatus;
  payment_method: string;
  transaction_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  orders?: Order;
}

export interface PaidTraffic {
  id: string;
  platform: string;
  campaign_name?: string;
  amount_cents: number;
  date: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CaktoSalesSummary {
  id: string;
  date: string;
  quantity: number;
  product_value_cents: number;
  fee_cents: number;
  total_sales_cents: number;
  total_fees_cents: number;
  net_revenue_cents: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyFinancialSummary {
  id: string;
  date: string;
  revenue_cents: number;
  costs_cents: number;
  profit_cents: number;
  cakto_sales_cents: number;
  pix_sales_cents: number;
  adjustments_cents: number;
  refunds_cents: number;
  fixed_costs_cents: number;
  variable_costs_cents: number;
  api_costs_cents: number;
  traffic_costs_cents: number;
  created_at: string;
  updated_at: string;
}
