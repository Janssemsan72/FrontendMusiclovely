-- ============================================
-- ⚠️ MIGRATION CRÍTICA: Criar tabela hotmart_webhook_logs
-- ============================================
-- COLE ESTE CÓDIGO NO SUPABASE DASHBOARD > SQL EDITOR E EXECUTE
-- ============================================

-- Criar tabela hotmart_webhook_logs (similar à cakto_webhook_logs)
CREATE TABLE IF NOT EXISTS hotmart_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Dados do webhook
  webhook_body JSONB NOT NULL,
  transaction_id TEXT,
  order_id_from_webhook TEXT,
  status_received TEXT,
  customer_email TEXT,
  amount_cents INTEGER,
  
  -- Status do processamento
  order_found BOOLEAN NOT NULL DEFAULT false,
  processing_success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  strategy_used TEXT,
  processing_time_ms INTEGER
);

-- Índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_created_at ON hotmart_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_transaction_id ON hotmart_webhook_logs(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_order_id ON hotmart_webhook_logs(order_id_from_webhook) WHERE order_id_from_webhook IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_customer_email ON hotmart_webhook_logs(customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_processing_success ON hotmart_webhook_logs(processing_success);
CREATE INDEX IF NOT EXISTS idx_hotmart_webhook_logs_status_received ON hotmart_webhook_logs(status_received) WHERE status_received IS NOT NULL;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_hotmart_webhook_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_hotmart_webhook_logs_updated_at ON hotmart_webhook_logs;
CREATE TRIGGER trigger_update_hotmart_webhook_logs_updated_at
  BEFORE UPDATE ON hotmart_webhook_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_hotmart_webhook_logs_updated_at();

-- Comentários para documentação
COMMENT ON TABLE hotmart_webhook_logs IS 'Logs de todos os webhooks recebidos da Hotmart para rastreamento e debug';
COMMENT ON COLUMN hotmart_webhook_logs.webhook_body IS 'Payload completo do webhook em formato JSONB';
COMMENT ON COLUMN hotmart_webhook_logs.transaction_id IS 'ID da transação da Hotmart (HP...)';
COMMENT ON COLUMN hotmart_webhook_logs.order_id_from_webhook IS 'ID do pedido se presente no webhook';
COMMENT ON COLUMN hotmart_webhook_logs.strategy_used IS 'Estratégia usada para encontrar o pedido: order_id_from_webhook, hotmart_transaction_id, email_most_recent, phone_most_recent';
COMMENT ON COLUMN hotmart_webhook_logs.processing_time_ms IS 'Tempo de processamento em milissegundos';

-- ============================================
-- Verificação (opcional - para confirmar que funcionou)
-- ============================================
-- Descomente as linhas abaixo para verificar:

-- SELECT 
--   table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'hotmart_webhook_logs'
-- ORDER BY ordinal_position;

-- ============================================
-- FIM DA MIGRATION
-- ============================================
