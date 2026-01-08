-- Script para RESTAURAR completamente a seção de depoimentos
-- Baseado na migration original: 20251018193232_17945987-774c-4584-b6b5-445cf751a59d.sql
-- Execute este script no Supabase SQL Editor

-- ============================================
-- PASSO 1: Limpar depoimentos antigos (opcional - descomente se quiser limpar tudo)
-- ============================================
-- DELETE FROM testimonials WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');

-- ============================================
-- PASSO 2: Garantir que a tabela existe com os campos corretos
-- ============================================
-- A tabela já deve existir, mas vamos garantir que tenha os campos necessários
-- Se a tabela não existir, execute a migration completa primeiro

-- ============================================
-- PASSO 3: Inserir/Restaurar os 3 depoimentos principais
-- ============================================

-- Depoimento 1: Ana Silva
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale) 
VALUES (
  'Ana Silva',
  'Noiva',
  'Encomendei uma música para meu casamento e foi simplesmente perfeita! Todos os convidados choraram. A qualidade de produção é incrível, parece música de rádio!',
  5,
  1,
  true,
  'pt'
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  content = EXCLUDED.content,
  rating = EXCLUDED.rating,
  display_order = EXCLUDED.display_order,
  is_active = true,
  locale = EXCLUDED.locale;

-- Depoimento 2: Carlos Mendes
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale) 
VALUES (
  'Carlos Mendes',
  'Empresário',
  'Criei um jingle para minha empresa e o resultado superou todas as expectativas. Profissionalismo e qualidade de estúdio, recomendo muito!',
  5,
  2,
  true,
  'pt'
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  content = EXCLUDED.content,
  rating = EXCLUDED.rating,
  display_order = EXCLUDED.display_order,
  is_active = true,
  locale = EXCLUDED.locale;

-- Depoimento 3: Mariana Costa
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale) 
VALUES (
  'Mariana Costa',
  'Filha',
  'Fiz uma homenagem para meu pai no aniversário de 60 anos dele. Ele ficou emocionado e não para de ouvir. Valeu cada centavo!',
  5,
  3,
  true,
  'pt'
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  content = EXCLUDED.content,
  rating = EXCLUDED.rating,
  display_order = EXCLUDED.display_order,
  is_active = true,
  locale = EXCLUDED.locale;

-- ============================================
-- PASSO 4: Atualizar depoimentos existentes para garantir que estejam ativos
-- ============================================
UPDATE testimonials 
SET 
  is_active = true,
  display_order = CASE 
    WHEN name = 'Ana Silva' THEN 1
    WHEN name = 'Carlos Mendes' THEN 2
    WHEN name = 'Mariana Costa' THEN 3
    ELSE display_order
  END
WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');

-- ============================================
-- PASSO 5: Verificar os depoimentos restaurados
-- ============================================
SELECT 
  id,
  name, 
  role, 
  LEFT(content, 50) || '...' as content_preview,
  rating, 
  display_order, 
  is_active,
  locale,
  created_at
FROM testimonials 
WHERE is_active = true
ORDER BY display_order ASC, created_at ASC;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- Deve retornar 3 depoimentos:
-- 1. Ana Silva (Noiva) - display_order: 1
-- 2. Carlos Mendes (Empresário) - display_order: 2
-- 3. Mariana Costa (Filha) - display_order: 3
-- Todos com is_active = true
