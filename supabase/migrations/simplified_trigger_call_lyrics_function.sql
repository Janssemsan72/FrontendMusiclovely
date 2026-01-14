-- ============================================
-- Migration SIMPLIFICADA: Trigger que chama Edge Function quando Job é Criado
-- Data: 2025-01-XX
-- Descrição: Versão simplificada que não requer configuração de variáveis
-- ============================================
-- Esta versão tenta chamar a Edge Function mas não falha se não conseguir
-- O webhook também chama a função, então temos redundância
-- ============================================

-- ============================================
-- Função simplificada que tenta chamar Edge Function
-- ============================================

CREATE OR REPLACE FUNCTION call_generate_lyrics_on_job_creation()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  supabase_service_key TEXT;
  http_response_id BIGINT;
  order_status TEXT;
BEGIN
  -- Só processar se job foi criado com status 'pending'
  IF NEW.status = 'pending' THEN
    
    -- Verificar se pedido está pago
    SELECT o.status INTO order_status
    FROM orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;
    
    -- Só chamar se pedido estiver pago
    IF order_status = 'paid' THEN
      
      -- Tentar obter configurações (pode falhar, mas não é crítico)
      BEGIN
        supabase_url := current_setting('app.supabase_url', true);
        supabase_service_key := current_setting('app.supabase_service_key', true);
        
        -- Se tiver as configurações, chamar Edge Function
        IF supabase_url IS NOT NULL AND supabase_service_key IS NOT NULL THEN
          -- Verificar se pg_net está disponível
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            SELECT net.http_post(
              url := supabase_url || '/functions/v1/generate-lyrics-for-approval',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || supabase_service_key
              ),
              body := jsonb_build_object('order_id', NEW.order_id::text)
            ) INTO http_response_id;
            
            RAISE NOTICE '✅ Edge Function chamada para job % (order_id: %)', NEW.id, NEW.order_id;
          ELSE
            RAISE NOTICE 'ℹ️ pg_net não disponível - Edge Function será chamada pelo webhook';
          END IF;
        ELSE
          RAISE NOTICE 'ℹ️ Variáveis não configuradas - Edge Function será chamada pelo webhook';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Não é crítico - o webhook também chama a função
          RAISE NOTICE 'ℹ️ Não foi possível chamar Edge Function do trigger: %. Webhook chamará a função.', SQLERRM;
      END;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Criar trigger
-- ============================================

DROP TRIGGER IF EXISTS trigger_call_generate_lyrics_on_job_creation ON jobs;

CREATE TRIGGER trigger_call_generate_lyrics_on_job_creation
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION call_generate_lyrics_on_job_creation();

COMMENT ON FUNCTION call_generate_lyrics_on_job_creation() IS 
'Tenta chamar a Edge Function generate-lyrics-for-approval quando um job é criado.
Se não conseguir (pg_net não disponível ou variáveis não configuradas), 
o webhook chamará a função (redundância para garantir funcionamento).';

COMMENT ON TRIGGER trigger_call_generate_lyrics_on_job_creation ON jobs IS 
'Dispara após INSERT na tabela jobs quando status é pending.
Tenta chamar a Edge Function generate-lyrics-for-approval automaticamente.';
