-- ============================================
-- Migration PARTE 1: Criar Função
-- ============================================
-- Execute esta parte primeiro se a migration completa der timeout
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

COMMENT ON FUNCTION create_job_on_payment() IS 
'Cria automaticamente um job quando um pedido é marcado como pago.
Verifica idempotência para evitar criar jobs duplicados.
Requer que o pedido tenha quiz_id.
A chamada da Edge Function generate-lyrics-for-approval é feita pelo webhook (src/routes/payment.ts).';
