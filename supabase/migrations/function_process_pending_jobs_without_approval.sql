-- ============================================
-- Migration: Função para Processar Jobs Pendentes sem Approval
-- Data: 2025-01-XX
-- Descrição: Função auxiliar para processar jobs que foram criados mas não têm approval
-- ============================================
-- Esta função pode ser chamada manualmente ou via cron job para garantir
-- que todos os jobs pendentes tenham suas letras geradas
-- ============================================

-- ============================================
-- Função para processar jobs pendentes sem approval
-- ============================================

CREATE OR REPLACE FUNCTION process_pending_jobs_without_approval()
RETURNS TABLE (
  job_id UUID,
  order_id UUID,
  processed BOOLEAN,
  message TEXT
) AS $$
DECLARE
  job_record RECORD;
  supabase_url TEXT;
  supabase_service_key TEXT;
  http_response_id BIGINT;
  processed_count INTEGER := 0;
BEGIN
  -- Buscar jobs pendentes sem approval e com pedido pago
  FOR job_record IN
    SELECT 
      j.id as job_id,
      j.order_id,
      j.status as job_status,
      o.status as order_status,
      o.quiz_id
    FROM jobs j
    INNER JOIN orders o ON j.order_id = o.id
    WHERE j.status = 'pending'
      AND o.status = 'paid'
      AND o.quiz_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM lyrics_approvals la 
        WHERE la.order_id = j.order_id
      )
    ORDER BY j.created_at ASC
    LIMIT 50  -- Processar no máximo 50 por vez
  LOOP
    
    -- Tentar chamar Edge Function
    BEGIN
      -- Tentar obter configurações
      supabase_url := current_setting('app.supabase_url', true);
      supabase_service_key := current_setting('app.supabase_service_key', true);
      
      -- Se tiver as configurações e pg_net disponível, chamar Edge Function
      IF supabase_url IS NOT NULL 
         AND supabase_service_key IS NOT NULL 
         AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        
        SELECT net.http_post(
          url := supabase_url || '/functions/v1/generate-lyrics-for-approval',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_service_key
          ),
          body := jsonb_build_object('order_id', job_record.order_id::text)
        ) INTO http_response_id;
        
        processed_count := processed_count + 1;
        
        RETURN QUERY SELECT 
          job_record.job_id,
          job_record.order_id,
          true as processed,
          'Edge Function chamada com sucesso (request_id: ' || http_response_id || ')' as message;
        
      ELSE
        -- Se não conseguir chamar, retornar informação
        RETURN QUERY SELECT 
          job_record.job_id,
          job_record.order_id,
          false as processed,
          'Não foi possível chamar Edge Function - variáveis não configuradas ou pg_net não disponível' as message;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RETURN QUERY SELECT 
          job_record.job_id,
          job_record.order_id,
          false as processed,
          'Erro ao chamar Edge Function: ' || SQLERRM as message;
    END;
    
    -- Pequeno delay entre chamadas para não sobrecarregar
    PERFORM pg_sleep(0.5);
    
  END LOOP;
  
  -- Retornar resumo
  IF processed_count = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID as job_id,
      NULL::UUID as order_id,
      false as processed,
      'Nenhum job pendente encontrado ou não foi possível processar' as message;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comentário na função
-- ============================================

COMMENT ON FUNCTION process_pending_jobs_without_approval() IS 
'Processa jobs pendentes que não têm approval associada.
Pode ser chamada manualmente ou via cron job para garantir que todos os jobs tenham suas letras geradas.
Retorna lista de jobs processados e status de cada um.';

-- ============================================
-- Exemplo de uso:
-- ============================================
-- SELECT * FROM process_pending_jobs_without_approval();
-- ============================================
