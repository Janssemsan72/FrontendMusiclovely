-- ============================================
-- Migration: Adicionar "hotmart" ao enum payment_provider
-- Data: 2025-01-XX
-- Descrição: Adiciona "hotmart" como valor válido no enum payment_provider
-- ============================================

-- ✅ CORREÇÃO: Adicionar "hotmart" ao enum payment_provider
-- Isso permite usar "hotmart" como valor para provider e payment_provider na tabela orders

-- Verificar se o enum já tem "hotmart" antes de adicionar
DO $$
BEGIN
  -- Tentar adicionar "hotmart" ao enum
  -- Se já existir, vai dar erro mas não é crítico
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
-- Verificação pós-migration
-- ============================================

-- Verificar valores do enum (opcional - pode ser executado separadamente)
-- SELECT enumlabel 
-- FROM pg_enum 
-- WHERE enumtypid = (
--   SELECT oid 
--   FROM pg_type 
--   WHERE typname = 'payment_provider'
-- )
-- ORDER BY enumsortorder;

-- ============================================
-- FIM DA MIGRATION
-- ============================================
