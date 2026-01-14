-- ============================================
-- Migration: Chamar Edge Function quando Job é Criado
-- Data: 2025-01-XX
-- Descrição: Cria trigger que chama generate-lyrics-for-approval automaticamente quando job é criado
-- ============================================

-- ============================================
-- 1. Função para chamar Edge Function quando job é criado
-- ============================================

CREATE OR REPLACE FUNCTION call_generate_lyrics_on_job_creation()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  supabase_service_key TEXT;
  http_response_id BIGINT;
  order_data RECORD;
BEGIN
  -- Só processar se job foi criado com status 'pending'
  IF NEW.status = 'pending' THEN
    
    -- Buscar dados do pedido para verificar se está pago
    SELECT o.id, o.status, o.quiz_id INTO order_data
    FROM orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;
    
    -- Só chamar se pedido estiver pago
    IF order_data.status = 'paid' AND order_data.quiz_id IS NOT NULL THEN
      
      -- Tentar obter URL e service key do Supabase
      BEGIN
        -- Tentar obter das variáveis de ambiente do Supabase
        supabase_url := current_setting('app.supabase_url', true);
        supabase_service_key := current_setting('app.supabase_service_key', true);
        
        -- Se não estiver configurado, tentar obter do vault (Supabase armazena secrets no vault)
        IF supabase_url IS NULL THEN
          SELECT decrypted_secret INTO supabase_url
          FROM vault.secrets
          WHERE name = 'supabase_url'
          LIMIT 1;
        END IF;
        
        IF supabase_service_key IS NULL THEN
          SELECT decrypted_secret INTO supabase_service_key
          FROM vault.secrets
          WHERE name = 'supabase_service_key'
          LIMIT 1;
        END IF;
        
        -- Se ainda não tiver, tentar construir URL a partir do projeto
        -- (Supabase geralmente tem a URL no formato: https://<project_ref>.supabase.co)
        IF supabase_url IS NULL THEN
          -- Tentar obter do vault ou usar padrão
          supabase_url := 'https://' || current_setting('app.project_ref', true) || '.supabase.co';
        END IF;
        
        -- Se as configurações estiverem disponíveis, chamar Edge Function via pg_net
        IF supabase_url IS NOT NULL AND supabase_service_key IS NOT NULL THEN
          -- Chamar Edge Function generate-lyrics-for-approval
          SELECT net.http_post(
            url := supabase_url || '/functions/v1/generate-lyrics-for-approval',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || supabase_service_key
            ),
            body := jsonb_build_object('order_id', NEW.order_id::text)
          ) INTO http_response_id;
          
          RAISE NOTICE 'Edge Function generate-lyrics-for-approval chamada para job % (order_id: %, request_id: %)', 
            NEW.id, NEW.order_id, http_response_id;
        ELSE
          -- Se não tiver acesso às configurações, apenas logar
          RAISE WARNING 'Não foi possível chamar Edge Function automaticamente para job % - variáveis não configuradas. URL: %, Key: %', 
            NEW.id, 
            CASE WHEN supabase_url IS NULL THEN 'NULL' ELSE 'CONFIGURADO' END,
            CASE WHEN supabase_service_key IS NULL THEN 'NULL' ELSE 'CONFIGURADO' END;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Se pg_net não estiver disponível ou houver erro, apenas logar
          RAISE WARNING 'Erro ao chamar Edge Function para job % (order_id: %): %', 
            NEW.id, NEW.order_id, SQLERRM;
      END;
      
    ELSE
      RAISE NOTICE 'Job % criado mas pedido não está pago ou não tem quiz_id - não chamando Edge Function', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Comentário na função
-- ============================================

COMMENT ON FUNCTION call_generate_lyrics_on_job_creation() IS 
'Chama automaticamente a Edge Function generate-lyrics-for-approval quando um job é criado.
Requer que o pedido esteja pago e tenha quiz_id.
Usa pg_net para fazer chamada HTTP à Edge Function.';

-- ============================================
-- 3. Criar trigger na tabela jobs
-- ============================================

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trigger_call_generate_lyrics_on_job_creation ON jobs;

CREATE TRIGGER trigger_call_generate_lyrics_on_job_creation
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION call_generate_lyrics_on_job_creation();

-- ============================================
-- 4. Comentário no trigger
-- ============================================

COMMENT ON TRIGGER trigger_call_generate_lyrics_on_job_creation ON jobs IS 
'Dispara após INSERT na tabela jobs quando status é pending.
Chama automaticamente a Edge Function generate-lyrics-for-approval para iniciar geração de letras.';

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Esta solução requer:
-- 1. Extensão pg_net habilitada
-- 2. Variáveis app.supabase_url e app.supabase_service_key configuradas
-- OU secrets no vault com nomes 'supabase_url' e 'supabase_service_key'
--
-- Se não for possível configurar, a função ainda funcionará mas não chamará a Edge Function.
-- Nesse caso, o webhook continuará chamando a Edge Function (já implementado).
-- ============================================
