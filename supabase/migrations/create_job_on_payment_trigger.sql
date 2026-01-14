-- ============================================
-- Migration: Criar Job Automaticamente quando Pedido é Pago
-- Data: 2025-01-XX
-- Descrição: Cria função e trigger para gerar job automaticamente quando pedido muda para status 'paid'
-- ============================================
-- IMPORTANTE: Execute esta migration em partes se houver timeout
-- Parte 1: Criar função
-- Parte 2: Criar trigger
-- ============================================

-- ============================================
-- PARTE 1: Função para criar job quando pedido é pago
-- ============================================

CREATE OR REPLACE FUNCTION create_job_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  existing_job_id UUID;
  order_quiz_id UUID;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Verificar se o pedido tem quiz_id (obrigatório para criar job)
    order_quiz_id := NEW.quiz_id;
    
    IF order_quiz_id IS NULL THEN
      -- Log de aviso se pedido não tem quiz_id
      RAISE WARNING 'Pedido % não tem quiz_id - não é possível criar job automaticamente', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ VERIFICAÇÃO DE IDEMPOTÊNCIA: Verificar se já existe um job para esse order_id
    SELECT id INTO existing_job_id
    FROM jobs
    WHERE order_id = NEW.id
    LIMIT 1;
    
    -- Se já existe um job, não criar outro
    IF existing_job_id IS NOT NULL THEN
      RAISE NOTICE 'Job já existe para pedido % (job_id: %) - pulando criação', NEW.id, existing_job_id;
      RETURN NEW;
    END IF;
    
    -- Criar novo job com status 'pending'
    INSERT INTO jobs (
      id,
      order_id,
      quiz_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      order_quiz_id,
      'pending',
      NOW(),
      NOW()
    )
    RETURNING id INTO existing_job_id;
    
    RAISE NOTICE 'Job criado automaticamente para pedido % (job_id: %)', NEW.id, existing_job_id;
    
    -- NOTA: A chamada da Edge Function generate-lyrics-for-approval é feita pelo webhook
    -- (src/routes/payment.ts) após atualizar o status do pedido para 'paid'.
    -- Isso evita problemas de permissão e é mais confiável.
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Comentário na função para documentação
-- ============================================

COMMENT ON FUNCTION create_job_on_payment() IS 
'Cria automaticamente um job quando um pedido é marcado como pago.
Verifica idempotência para evitar criar jobs duplicados.
Requer que o pedido tenha quiz_id.
A chamada da Edge Function generate-lyrics-for-approval é feita pelo webhook (src/routes/payment.ts).';

-- ============================================
-- PARTE 2: Criar trigger que dispara após UPDATE em orders
-- ============================================
-- NOTA: Se houver timeout, execute esta parte separadamente
-- ============================================

-- Remover trigger se já existir (para permitir reexecução da migration)
DROP TRIGGER IF EXISTS trigger_create_job_on_payment ON orders;

-- Criar trigger com índice otimizado
-- O trigger só dispara quando status muda para 'paid', então é eficiente
CREATE TRIGGER trigger_create_job_on_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION create_job_on_payment();

-- ============================================
-- 4. Comentário no trigger para documentação
-- ============================================

COMMENT ON TRIGGER trigger_create_job_on_payment ON orders IS 
'Dispara após UPDATE na tabela orders quando status muda para paid.
Cria automaticamente um job para iniciar o processo de geração de letras.';

-- ============================================
-- 5. Verificação pós-migration (opcional - pode ser executado separadamente)
-- ============================================

-- Verificar se o trigger foi criado corretamente
-- SELECT 
--   t.tgname as trigger_name,
--   c.relname as table_name,
--   CASE 
--     WHEN t.tgenabled = 'D' THEN 'DESABILITADO'
--     WHEN t.tgenabled = 'O' THEN 'HABILITADO'
--     WHEN t.tgenabled = 'A' THEN 'HABILITADO'
--     ELSE 'STATUS: ' || t.tgenabled::text
--   END as status
-- FROM pg_trigger t
-- JOIN pg_class c ON t.tgrelid = c.oid
-- WHERE c.relname = 'orders'
--   AND t.tgname = 'trigger_create_job_on_payment';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
