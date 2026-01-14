-- ============================================
-- Migration: Garantir Geração de Letras quando Job é Criado
-- Data: 2025-01-XX
-- Descrição: Cria trigger que garante que a Edge Function seja chamada quando job é criado
-- ============================================
-- Esta migration cria um trigger na tabela jobs que tenta chamar a Edge Function
-- quando um job é criado. Se não conseguir (pg_net não disponível), não é crítico
-- pois o webhook também chama a função (redundância).
-- ============================================

-- ============================================
-- 1. Função para garantir chamada da Edge Function
-- ============================================

CREATE OR REPLACE FUNCTION ensure_lyrics_generation_on_job_creation()
RETURNS TRIGGER AS $$
DECLARE
  order_status TEXT;
  order_quiz_id UUID;
BEGIN
  -- Só processar se job foi criado com status 'pending'
  IF NEW.status = 'pending' THEN
    
    -- Buscar status do pedido e quiz_id
    SELECT o.status, o.quiz_id INTO order_status, order_quiz_id
    FROM orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;
    
    -- Só processar se pedido estiver pago e tiver quiz_id
    IF order_status = 'paid' AND order_quiz_id IS NOT NULL THEN
      
      -- Verificar se já existe approval (idempotência)
      IF NOT EXISTS (
        SELECT 1 FROM lyrics_approvals 
        WHERE order_id = NEW.order_id 
        LIMIT 1
      ) THEN
        
        -- Tentar chamar Edge Function via pg_net (se disponível)
        BEGIN
          -- Verificar se pg_net está disponível
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            -- Tentar obter URL e service key
            DECLARE
              supabase_url TEXT;
              supabase_service_key TEXT;
              http_response_id BIGINT;
            BEGIN
              -- Tentar obter das configurações
              supabase_url := current_setting('app.supabase_url', true);
              supabase_service_key := current_setting('app.supabase_service_key', true);
              
              -- Se tiver as configurações, chamar Edge Function
              IF supabase_url IS NOT NULL AND supabase_service_key IS NOT NULL THEN
                SELECT net.http_post(
                  url := supabase_url || '/functions/v1/generate-lyrics-for-approval',
                  headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || supabase_service_key
                  ),
                  body := jsonb_build_object('order_id', NEW.order_id::text)
                ) INTO http_response_id;
                
                RAISE NOTICE '✅ [Trigger Jobs] Edge Function generate-lyrics-for-approval chamada para job % (order_id: %, request_id: %)', 
                  NEW.id, NEW.order_id, http_response_id;
              ELSE
                RAISE NOTICE 'ℹ️ [Trigger Jobs] Variáveis não configuradas - Edge Function será chamada pelo webhook para job % (order_id: %)', 
                  NEW.id, NEW.order_id;
              END IF;
            EXCEPTION
              WHEN OTHERS THEN
                RAISE NOTICE 'ℹ️ [Trigger Jobs] Não foi possível chamar Edge Function do trigger para job %: %. Webhook chamará a função.', 
                  NEW.id, SQLERRM;
            END;
          ELSE
            RAISE NOTICE 'ℹ️ [Trigger Jobs] pg_net não disponível - Edge Function será chamada pelo webhook para job % (order_id: %)', 
              NEW.id, NEW.order_id;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- Não é crítico - o webhook também chama a função
            RAISE NOTICE 'ℹ️ [Trigger Jobs] Erro ao tentar chamar Edge Function para job %: %. Webhook chamará a função.', 
              NEW.id, SQLERRM;
        END;
        
      ELSE
        RAISE NOTICE 'ℹ️ [Trigger Jobs] Approval já existe para job % (order_id: %) - pulando chamada de Edge Function', 
          NEW.id, NEW.order_id;
      END IF;
      
    ELSE
      RAISE NOTICE 'ℹ️ [Trigger Jobs] Job % criado mas pedido não está pago ou não tem quiz_id - não chamando Edge Function', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Comentário na função
-- ============================================

COMMENT ON FUNCTION ensure_lyrics_generation_on_job_creation() IS 
'Tenta chamar a Edge Function generate-lyrics-for-approval quando um job é criado.
Se não conseguir (pg_net não disponível ou variáveis não configuradas), 
não é crítico pois o webhook também chama a função (redundância para garantir funcionamento).
Verifica idempotência para evitar chamadas duplicadas.';

-- ============================================
-- 3. Criar trigger na tabela jobs
-- ============================================

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trigger_ensure_lyrics_generation_on_job_creation ON jobs;

CREATE TRIGGER trigger_ensure_lyrics_generation_on_job_creation
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION ensure_lyrics_generation_on_job_creation();

-- ============================================
-- 4. Comentário no trigger
-- ============================================

COMMENT ON TRIGGER trigger_ensure_lyrics_generation_on_job_creation ON jobs IS 
'Dispara após INSERT na tabela jobs quando status é pending.
Tenta chamar a Edge Function generate-lyrics-for-approval automaticamente.
Se não conseguir, o webhook também chama a função (redundância).';

-- ============================================
-- IMPORTANTE:
-- ============================================
-- Esta solução funciona como REDUNDÂNCIA:
-- 1. O webhook chama a Edge Function (já implementado)
-- 2. Este trigger também tenta chamar (backup)
-- 
-- Se o trigger não conseguir chamar (pg_net não disponível), 
-- o webhook ainda chamará, garantindo que a função seja executada.
-- ============================================
