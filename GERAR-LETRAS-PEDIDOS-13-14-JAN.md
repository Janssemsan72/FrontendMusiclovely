# Gerar Letras para Pedidos 13/01 (21h+) e 14/01

## Opção 1: Script Node.js (RECOMENDADO)

Execute o script que busca os pedidos e chama a Edge Function automaticamente:

```bash
# Certifique-se de ter as variáveis de ambiente configuradas
export SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# Executar o script
node scripts/gerar-letras-pedidos-13-14-jan.js
```

O script irá:
1. ✅ Buscar todos os pedidos pagos do período especificado
2. ✅ Verificar quais já têm approval (não processar duplicados)
3. ✅ Chamar a Edge Function `generate-lyrics-for-approval` para cada pedido
4. ✅ Mostrar progresso e resumo final

## Opção 2: Via Supabase Dashboard

### Passo 1: Identificar os pedidos

Execute a query SQL no Supabase Dashboard → SQL Editor:

```sql
-- Identificar pedidos pagos do dia 13/01 (21h+) e 14/01
SELECT 
  o.id as order_id,
  o.customer_email,
  o.status,
  o.paid_at,
  o.quiz_id,
  CASE WHEN j.id IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_job,
  CASE WHEN la.id IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_approval
FROM orders o
LEFT JOIN jobs j ON j.order_id = o.id
LEFT JOIN lyrics_approvals la ON la.order_id = o.id
WHERE o.status = 'paid'
  AND o.quiz_id IS NOT NULL
  AND (
    (o.paid_at >= '2025-01-13 21:00:00-03:00' AND o.paid_at < '2025-01-14 00:00:00-03:00')
    OR
    (o.paid_at >= '2025-01-14 00:00:00-03:00' AND o.paid_at < '2025-01-15 00:00:00-03:00')
  )
ORDER BY o.paid_at ASC;
```

### Passo 2: Gerar letras manualmente

Para cada `order_id` retornado que **NÃO** tem approval, chame a Edge Function:

1. Acesse **Supabase Dashboard → Edge Functions → generate-lyrics-for-approval**
2. Clique em **Invoke**
3. No body, coloque:
```json
{
  "order_id": "uuid-do-pedido-aqui"
}
```
4. Clique em **Invoke**

## Opção 3: Via API/Backend

Se você tiver acesso ao backend, pode chamar a Edge Function via código:

```typescript
const { data, error } = await supabase.functions.invoke(
  'generate-lyrics-for-approval',
  {
    body: { order_id: 'uuid-do-pedido' }
  }
);
```

## Verificação

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
