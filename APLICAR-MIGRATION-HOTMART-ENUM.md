# ⚠️ MIGRATION CRÍTICA: Adicionar "hotmart" ao enum payment_provider

## Problema
O enum `payment_provider` no banco de dados só aceita "stripe" ou "cakto", mas o código está tentando usar "hotmart", causando o erro:
```
invalid input value for enum payment_provider: "hotmart"
```

## ⚡ SOLUÇÃO RÁPIDA (EXECUTAR AGORA)

### Passo a passo:
1. **Acesse o Supabase Dashboard**: https://supabase.com/dashboard
2. **Selecione seu projeto**
3. **Vá em "SQL Editor"** (menu lateral)
4. **Cole o código abaixo** e clique em "Run":

```sql
-- Adicionar "hotmart" ao enum payment_provider
DO $$
BEGIN
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
    RAISE NOTICE 'ℹ️ Valor "hotmart" pode já existir no enum: %', SQLERRM;
END $$;
```

5. **Verifique se funcionou** (opcional):
```sql
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

## Arquivo da migration completa
`supabase/migrations/add_hotmart_to_payment_provider_enum.sql`

## O que a migration faz
- Adiciona "hotmart" como valor válido ao enum `payment_provider`
- Verifica se o valor já existe antes de adicionar (idempotente)
- Permite usar "hotmart" em `provider` e `payment_provider` na tabela `orders`

## Importante
⚠️ **Esta migration é OBRIGATÓRIA** para que os pedidos sejam criados corretamente com provider "hotmart".

**Após aplicar, teste novamente criando um pedido no checkout.**
