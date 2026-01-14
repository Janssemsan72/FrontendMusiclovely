-- ============================================
-- ⚠️ MIGRATION CRÍTICA: Adicionar "hotmart" ao enum payment_provider
-- ============================================
-- COLE ESTE CÓDIGO NO SUPABASE DASHBOARD > SQL EDITOR E EXECUTE
-- ============================================

-- Adicionar "hotmart" ao enum payment_provider
DO $$
BEGIN
  -- Verificar se o enum já tem "hotmart" antes de adicionar
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'hotmart' 
    AND enumtypid = (
      SELECT oid 
      FROM pg_type 
      WHERE typname = 'payment_provider'
    )
  ) THEN
    ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'hotmart';
    RAISE NOTICE '✅ Valor "hotmart" adicionado ao enum payment_provider';
  ELSE
    RAISE NOTICE 'ℹ️ Valor "hotmart" já existe no enum payment_provider';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Se der erro (ex: valor já existe), apenas logar
    RAISE NOTICE 'ℹ️ Valor "hotmart" pode já existir no enum: %', SQLERRM;
END $$;

-- ============================================
-- Verificação (opcional - para confirmar que funcionou)
-- ============================================
-- Descomente as linhas abaixo para verificar:

-- SELECT enumlabel 
-- FROM pg_enum 
-- WHERE enumtypid = (
--   SELECT oid 
--   FROM pg_type 
--   WHERE typname = 'payment_provider'
-- )
-- ORDER BY enumsortorder;

-- Deve retornar: stripe, cakto, hotmart
