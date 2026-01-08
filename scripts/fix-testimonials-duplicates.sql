-- Script para corrigir depoimentos duplicados e garantir que apareçam na página
-- Execute este script no Supabase SQL Editor

-- ============================================
-- PASSO 1: Verificar situação atual
-- ============================================
SELECT 
  id,
  name, 
  role, 
  is_active,
  display_order,
  created_at
FROM testimonials 
ORDER BY name, created_at;

-- ============================================
-- PASSO 2: Manter apenas os depoimentos mais recentes de cada nome
-- ============================================

-- Deletar depoimentos duplicados, mantendo apenas o mais recente de cada nome
DELETE FROM testimonials 
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at DESC) as rn
    FROM testimonials
    WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa')
  ) sub
  WHERE rn > 1
);

-- ============================================
-- PASSO 3: Garantir que os 3 depoimentos estejam corretos e ativos
-- ============================================

-- Atualizar Ana Silva
UPDATE testimonials 
SET 
  name = 'Ana Silva',
  role = 'Noiva',
  content = 'Encomendei uma música para meu casamento e foi simplesmente perfeita! Todos os convidados choraram. A qualidade de produção é incrível, parece música de rádio!',
  rating = 5,
  display_order = 1,
  is_active = true,
  locale = 'pt'
WHERE name = 'Ana Silva';

-- Atualizar Carlos Mendes
UPDATE testimonials 
SET 
  name = 'Carlos Mendes',
  role = 'Empresário',
  content = 'Criei um jingle para minha empresa e o resultado superou todas as expectativas. Profissionalismo e qualidade de estúdio, recomendo muito!',
  rating = 5,
  display_order = 2,
  is_active = true,
  locale = 'pt'
WHERE name = 'Carlos Mendes';

-- Atualizar Mariana Costa
UPDATE testimonials 
SET 
  name = 'Mariana Costa',
  role = 'Filha',
  content = 'Fiz uma homenagem para meu pai no aniversário de 60 anos dele. Ele ficou emocionado e não para de ouvir. Valeu cada centavo!',
  rating = 5,
  display_order = 3,
  is_active = true,
  locale = 'pt'
WHERE name = 'Mariana Costa';

-- ============================================
-- PASSO 4: Se algum depoimento não existir, criar
-- ============================================

-- Criar Ana Silva se não existir
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale)
SELECT 
  'Ana Silva',
  'Noiva',
  'Encomendei uma música para meu casamento e foi simplesmente perfeita! Todos os convidados choraram. A qualidade de produção é incrível, parece música de rádio!',
  5,
  1,
  true,
  'pt'
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Ana Silva');

-- Criar Carlos Mendes se não existir
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale)
SELECT 
  'Carlos Mendes',
  'Empresário',
  'Criei um jingle para minha empresa e o resultado superou todas as expectativas. Profissionalismo e qualidade de estúdio, recomendo muito!',
  5,
  2,
  true,
  'pt'
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Carlos Mendes');

-- Criar Mariana Costa se não existir
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale)
SELECT 
  'Mariana Costa',
  'Filha',
  'Fiz uma homenagem para meu pai no aniversário de 60 anos dele. Ele ficou emocionado e não para de ouvir. Valeu cada centavo!',
  5,
  3,
  true,
  'pt'
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE name = 'Mariana Costa');

-- ============================================
-- PASSO 5: Verificar resultado final
-- ============================================
SELECT 
  id,
  name, 
  role, 
  LEFT(content, 50) || '...' as content_preview,
  rating, 
  display_order, 
  is_active,
  locale
FROM testimonials 
WHERE is_active = true
ORDER BY display_order ASC;

-- Deve retornar exatamente 3 depoimentos:
-- 1. Ana Silva (Noiva) - display_order: 1
-- 2. Carlos Mendes (Empresário) - display_order: 2
-- 3. Mariana Costa (Filha) - display_order: 3
