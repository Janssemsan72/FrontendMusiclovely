# 🔧 Solução Completa para Depoimentos Não Aparecerem

## Problema Identificado

1. **Depoimentos duplicados no banco** (6 depoimentos, sendo 3 duplicados)
2. **LazySection pode não estar carregando** (IntersectionObserver)
3. **Possível problema com `is_active`**

## ✅ Solução em 3 Passos

### PASSO 1: Limpar Duplicatas e Corrigir Depoimentos

Execute este script no **Supabase SQL Editor**:

```sql
-- Limpar duplicatas, mantendo apenas os mais recentes
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

-- Garantir que os 3 depoimentos estejam corretos
UPDATE testimonials 
SET 
  is_active = true,
  display_order = CASE 
    WHEN name = 'Ana Silva' THEN 1
    WHEN name = 'Carlos Mendes' THEN 2
    WHEN name = 'Mariana Costa' THEN 3
  END,
  rating = 5
WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');

-- Verificar resultado
SELECT name, role, is_active, display_order, rating 
FROM testimonials 
WHERE is_active = true
ORDER BY display_order;
```

**OU** execute o arquivo completo: `scripts/fix-testimonials-duplicates.sql`

### PASSO 2: Verificar no Console do Navegador

1. Abra a página inicial
2. Pressione **F12** para abrir o console
3. Procure por estas mensagens:
   - ✅ `"Depoimentos ativos encontrados: Array(3)"` - Significa que encontrou os depoimentos
   - ❌ `"Nenhum depoimento encontrado"` - Significa que não encontrou nenhum
   - ❌ `"Erro ao buscar depoimentos:"` - Significa erro na conexão

### PASSO 3: Forçar Renderização (Se ainda não aparecer)

Se os depoimentos estão no banco mas não aparecem, pode ser problema do LazySection. 

**Opção A: Remover LazySection temporariamente (para testar)**

No arquivo `src/pages/Index.tsx`, linha ~166, substitua:

```tsx
<LazySection minHeight={520} rootMargin="200px 0px">
  <Testimonials />
</LazySection>
```

Por:

```tsx
<Testimonials />
```

Isso vai carregar os depoimentos imediatamente, sem lazy loading.

**Opção B: Aumentar rootMargin (já feito)**

O código já foi atualizado para carregar 200px antes da seção entrar na viewport.

## 🔍 Verificações Finais

Execute este SQL para verificar tudo:

```sql
SELECT 
  id,
  name, 
  role, 
  is_active,
  display_order,
  rating,
  LEFT(content, 50) || '...' as preview
FROM testimonials 
ORDER BY name, created_at;
```

**Resultado esperado:**
- Deve ter exatamente 3 depoimentos (um de cada nome)
- Todos com `is_active = true`
- `display_order` = 1, 2, 3
- `rating` = 5

## 🐛 Troubleshooting Avançado

### Se ainda não aparecer após tudo:

1. **Verificar permissões RLS (Row Level Security):**
   ```sql
   -- Verificar políticas RLS
   SELECT * FROM pg_policies WHERE tablename = 'testimonials';
   
   -- Se necessário, criar política pública de leitura
   CREATE POLICY "Public read access" ON testimonials
   FOR SELECT USING (is_active = true);
   ```

2. **Verificar conexão Supabase:**
   - Verifique o arquivo `.env` ou variáveis de ambiente
   - Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretos

3. **Limpar cache do navegador:**
   - Pressione `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
   - Ou limpe o cache manualmente

4. **Verificar se o componente está sendo importado:**
   - Abra o console e procure por erros de importação
   - Verifique se há erros de compilação

## 📝 Checklist Final

- [ ] Script SQL executado com sucesso
- [ ] 3 depoimentos no banco (sem duplicatas)
- [ ] Todos com `is_active = true`
- [ ] Console mostra "Depoimentos ativos encontrados: Array(3)"
- [ ] Página recarregada (Ctrl+Shift+R)
- [ ] Seção de depoimentos aparece na página

Se todos os itens estiverem marcados e ainda não aparecer, pode ser um problema de CSS ou o componente está retornando `null` por algum motivo. Verifique o console para mais detalhes.
