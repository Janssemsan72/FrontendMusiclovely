-- Migration: Adicionar suporte para Hotmart como gateway de pagamento
-- Data: 2024-01-XX
-- Descrição: Adiciona campos Hotmart na tabela orders e cria tabela hotmart_webhook_logs

-- ============================================
-- 1. Adicionar campos Hotmart na tabela orders
-- ============================================

-- Adicionar hotmart_payment_url (similar a cakto_payment_url)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS hotmart_payment_url TEXT;

-- Adicionar hotmart_transaction_id (similar a cakto_transaction_id)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT;

-- Adicionar hotmart_payment_status (similar a cakto_payment_status)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS hotmart_payment_status TEXT;

-- Criar índice para hotmart_transaction_id para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_orders_hotmart_transaction_id 
ON orders(hotmart_transaction_id) 
WHERE hotmart_transaction_id IS NOT NULL;

-- ============================================
-- 2. Criar tabela hotmart_webhook_logs
-- ============================================

CREATE TABLE IF NOT EXISTS hotmart_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_body JSONB NOT NULL,
  transaction_id TEXT,
  order_id_from_webhook UUID,
  status_received TEXT,
  customer_email TEXT,
  amount_cents INTEGER,
  order_found BOOLEAN DEFAULT false,
  processing_success BOOLEAN DEFAULT false,
  strategy_used TEXT,
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_transaction_id 
ON hotmart_webhook_logs(transaction_id) 
WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_order_id 
ON hotmart_webhook_logs(order_id_from_webhook) 
WHERE order_id_from_webhook IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_customer_email 
ON hotmart_webhook_logs(customer_email) 
WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_created_at 
ON hotmart_webhook_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_processing_success 
ON hotmart_webhook_logs(processing_success);

-- ============================================
-- 3. Adicionar comentários para documentação
-- ============================================

COMMENT ON COLUMN orders.hotmart_payment_url IS 'URL de pagamento gerada pela Hotmart para este pedido';
COMMENT ON COLUMN orders.hotmart_transaction_id IS 'ID da transação retornado pelo webhook da Hotmart';
COMMENT ON COLUMN orders.hotmart_payment_status IS 'Status do pagamento na Hotmart (approved, cancelled, chargeback, etc)';
COMMENT ON TABLE hotmart_webhook_logs IS 'Logs de webhooks recebidos da Hotmart para rastreamento e debugging';
