# ⚠️ MIGRATION CRÍTICA: Adicionar "hotmart" ao enum payment_provider

## Problema
O enum `payment_provider` no banco de dados só aceita "stripe" ou "cakto", mas o código está tentando usar "hotmart", causando o erro:
```
invalid input value for enum payment_provider: "hotmart"
```

## Solução
Aplicar a migration que adiciona "hotmart" ao enum.

## Como aplicar

### Opção 1: Via Supabase Dashboard (RECOMENDADO)
1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `supabase/migrations/add_hotmart_to_payment_provider_enum.sql`
4. Execute a query

### Opção 2: Via Supabase CLI
```bash
supabase db push
```

## Arquivo da migration
`supabase/migrations/add_hotmart_to_payment_provider_enum.sql`

## O que a migration faz
- Adiciona "hotmart" como valor válido ao enum `payment_provider`
- Verifica se o valor já existe antes de adicionar (idempotente)
- Permite usar "hotmart" em `provider` e `payment_provider` na tabela `orders`

## Verificação
Após aplicar a migration, verifique se funcionou:

```sql
-- Verificar valores do enum
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'payment_provider'
)
ORDER BY enumsortorder;
```

Deve retornar: `stripe`, `cakto`, `hotmart`

## Importante
⚠️ **Esta migration é OBRIGATÓRIA** para que os pedidos sejam criados corretamente com provider "hotmart".
