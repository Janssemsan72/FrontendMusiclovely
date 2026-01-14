# 🎵 Gerar Letras para Pedidos 13/01 (21h+) e 14/01

## ⚡ Solução Rápida (RECOMENDADO)

### Passo 1: Configurar Variáveis de Ambiente

No PowerShell, execute:

```powershell
$env:SUPABASE_URL="https://zagkvtxarndluusiluhb.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role_aqui"
```

**Onde obter a chave:**
1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto `zagkvtxarndluusiluhb`
3. Vá em **Settings** → **API**
4. Copie a chave **service_role** (NÃO a anon!)

### Passo 2: Executar o Script

```powershell
cd "c:\Users\Janssem Santos\Desktop\Dev\Musiclovelyoficial-main 67"
node scripts/gerar-letras-pedidos-13-14-jan.js
```

O script irá:
- ✅ Buscar todos os pedidos pagos do período
- ✅ Verificar quais já têm approval
- ✅ Chamar a Edge Function para cada pedido que precisa
- ✅ Mostrar progresso em tempo real
- ✅ Exibir resumo final com sucessos e erros

---

## 🔧 Solução Alternativa: Via Supabase Dashboard

### Passo 1: Identificar Pedidos

Execute no **Supabase Dashboard → SQL Editor**:

```sql
-- Listar pedidos que precisam de letra
SELECT 
  o.id as order_id,
  o.customer_email,
  o.paid_at,
  CASE WHEN la.id IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_approval
FROM orders o
LEFT JOIN lyrics_approvals la ON la.order_id = o.id
WHERE o.status = 'paid'
  AND o.quiz_id IS NOT NULL
  AND (
    (o.paid_at >= '2025-01-13 21:00:00-03:00' AND o.paid_at < '2025-01-14 00:00:00-03:00')
    OR
    (o.paid_at >= '2025-01-14 00:00:00-03:00' AND o.paid_at < '2025-01-15 00:00:00-03:00')
  )
  AND la.id IS NULL  -- Apenas os que NÃO têm approval
ORDER BY o.paid_at ASC;
```

### Passo 2: Gerar Letras Manualmente

Para cada `order_id` retornado:

1. Acesse **Supabase Dashboard → Edge Functions → generate-lyrics-for-approval**
2. Clique em **Invoke**
3. No body JSON, coloque:
```json
{
  "order_id": "uuid-do-pedido-aqui"
}
```
4. Clique em **Invoke**
5. Repita para cada pedido

---

## 📊 Verificação

Após processar, verifique se as letras foram geradas:

```sql
-- Verificar approvals criadas
SELECT 
  la.id,
  la.order_id,
  la.status,
  la.created_at,
  o.customer_email,
  o.paid_at
FROM lyrics_approvals la
INNER JOIN orders o ON la.order_id = o.id
WHERE o.status = 'paid'
  AND (
    (o.paid_at >= '2025-01-13 21:00:00-03:00' AND o.paid_at < '2025-01-14 00:00:00-03:00')
    OR
    (o.paid_at >= '2025-01-14 00:00:00-03:00' AND o.paid_at < '2025-01-15 00:00:00-03:00')
  )
ORDER BY la.created_at DESC;
```

---

## 🚀 Solução Automatizada (Aplicar Migration)

Se quiser usar a função RPC criada:

1. Aplique a migration: `supabase/migrations/function_get_orders_13_14_jan.sql`
2. Execute no SQL Editor:
```sql
SELECT * FROM get_orders_13_14_jan() WHERE tem_approval = false;
```

Isso retornará todos os pedidos que precisam de letras.

---

## ⚠️ Importante

- O script verifica idempotência (não gera letras duplicadas)
- Aguarda 2 segundos entre cada chamada para não sobrecarregar
- Mostra progresso detalhado de cada pedido
- Exibe resumo final com sucessos e erros
