# Como Restaurar a Seção de Depoimentos

Este guia explica como restaurar os 3 depoimentos principais na página inicial.

## 🚀 Restauração Rápida (Recomendado)

### Opção 1: Script de Restauração Completa

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `scripts/restore-testimonials.sql`
4. Copie e cole todo o conteúdo no editor SQL
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Verifique o resultado - deve mostrar 3 depoimentos

### Opção 2: Script Simples de Inserção

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `scripts/insert-testimonials.sql`
4. Copie e cole todo o conteúdo no editor SQL
5. Clique em **Run** ou pressione `Ctrl+Enter`
6. Verifique o resultado - deve mostrar 3 depoimentos

## 📋 Depoimentos que Serão Restaurados

### 1. Ana Silva (Noiva)
- **Depoimento:** "Encomendei uma música para meu casamento e foi simplesmente perfeita! Todos os convidados choraram. A qualidade de produção é incrível, parece música de rádio!"
- **Avaliação:** ⭐⭐⭐⭐⭐ (5 estrelas)
- **Ordem:** 1

### 2. Carlos Mendes (Empresário)
- **Depoimento:** "Criei um jingle para minha empresa e o resultado superou todas as expectativas. Profissionalismo e qualidade de estúdio, recomendo muito!"
- **Avaliação:** ⭐⭐⭐⭐⭐ (5 estrelas)
- **Ordem:** 2

### 3. Mariana Costa (Filha)
- **Depoimento:** "Fiz uma homenagem para meu pai no aniversário de 60 anos dele. Ele ficou emocionado e não para de ouvir. Valeu cada centavo!"
- **Avaliação:** ⭐⭐⭐⭐⭐ (5 estrelas)
- **Ordem:** 3

## ✅ Verificação Pós-Restauração

Após executar o script, verifique:

1. **No Supabase:**
   ```sql
   SELECT name, role, is_active, display_order 
   FROM testimonials 
   WHERE is_active = true 
   ORDER BY display_order;
   ```
   Deve retornar 3 linhas.

2. **Na Aplicação:**
   - Recarregue a página inicial
   - A seção "Depoimentos" deve aparecer
   - Os 3 depoimentos devem estar visíveis no carrossel
   - As estatísticas (500+, 5.0, 48h) devem aparecer no final

3. **No Console do Navegador (F12):**
   - Deve aparecer: "Depoimentos ativos encontrados: Array(3)"
   - Não deve haver erros relacionados ao Supabase

## 🔧 Troubleshooting

### Problema: Script não executa
- Verifique se você tem permissões de escrita no Supabase
- Verifique se a tabela `testimonials` existe
- Execute a migration completa se necessário

### Problema: Depoimentos não aparecem após inserir
1. Verifique se `is_active = true`:
   ```sql
   UPDATE testimonials SET is_active = true WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');
   ```

2. Verifique se `display_order` está definido:
   ```sql
   UPDATE testimonials 
   SET display_order = CASE 
     WHEN name = 'Ana Silva' THEN 1
     WHEN name = 'Carlos Mendes' THEN 2
     WHEN name = 'Mariana Costa' THEN 3
   END
   WHERE name IN ('Ana Silva', 'Carlos Mendes', 'Mariana Costa');
   ```

3. Limpe o cache do navegador (Ctrl+Shift+R)

### Problema: Erro de conexão
- Verifique as credenciais do Supabase no `.env`
- Verifique se a URL do Supabase está correta
- Verifique se há problemas de rede/firewall

## 📝 Notas Técnicas

- Os scripts são baseados na migration original: `20251018193232_17945987-774c-4584-b6b5-445cf751a59d.sql`
- Os depoimentos são inseridos com `locale = 'pt'` (português)
- O script `restore-testimonials.sql` é mais robusto e trata conflitos
- O script `insert-testimonials.sql` é mais simples e direto
