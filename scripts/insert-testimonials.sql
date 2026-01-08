-- Script para restaurar/inserir depoimentos na tabela testimonials
-- Baseado na migration original: 20251018193232_17945987-774c-4584-b6b5-445cf751a59d.sql
-- Execute este script no Supabase SQL Editor

-- Primeiro, deletar depoimentos antigos com os mesmos nomes (para evitar duplicatas)
DELETE FROM testimonials 
WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');

-- Inserir os 3 depoimentos principais
INSERT INTO testimonials (name, role, content, rating, display_order, is_active, locale) 
VALUES
  (
    'Ana Silva',
    'Noiva',
    'Encomendei uma música para meu casamento e foi simplesmente perfeita! Todos os convidados choraram. A qualidade de produção é incrível, parece música de rádio!',
    5,
    1,
    true,
    'pt'
  ),
  (
    'Carlos Mendes',
    'Empresário',
    'Criei um jingle para minha empresa e o resultado superou todas as expectativas. Profissionalismo e qualidade de estúdio, recomendo muito!',
    5,
    2,
    true,
    'pt'
  ),
  (
    'Mariana Costa',
    'Filha',
    'Fiz uma homenagem para meu pai no aniversário de 60 anos dele. Ele ficou emocionado e não para de ouvir. Valeu cada centavo!',
    5,
    3,
    true,
    'pt'
  );

-- Atualizar TODOS os depoimentos existentes para ativos (garantir que apareçam)
UPDATE testimonials 
SET is_active = true,
    display_order = COALESCE(display_order, 0)
WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');

-- Verificar os depoimentos inseridos
SELECT 
  id, 
  name, 
  role, 
  content, 
  rating, 
  display_order, 
  is_active,
  locale
FROM testimonials 
WHERE is_active = true
ORDER BY display_order ASC, created_at ASC;
