# Migration: Suporte Hotmart

## Arquivo SQL
O arquivo `supabase/migrations/add_hotmart_support.sql` contém todas as alterações necessárias.

## Como aplicar a migration

### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Cole o conteúdo do arquivo `supabase/migrations/add_hotmart_support.sql`
4. Execute a query

### Opção 2: Via Supabase CLI
```bash
supabase db push
```

## O que a migration faz

### 1. Adiciona campos na tabela `orders`:
- `hotmart_payment_url` (TEXT) - URL de pagamento gerada pela Hotmart
- `hotmart_transaction_id` (TEXT) - ID da transação do webhook
- `hotmart_payment_status` (TEXT) - Status do pagamento (approved, cancelled, etc)

### 2. Cria tabela `hotmart_webhook_logs`:
- Logs de todos os webhooks recebidos da Hotmart
- Campos similares à tabela `cakto_webhook_logs`
- Índices para melhor performance

### 3. Índices criados:
- `idx_orders_hotmart_transaction_id` - Para buscas rápidas por transaction_id
- `idx_hotmart_webhook_logs_transaction_id` - Para logs
- `idx_hotmart_webhook_logs_order_id` - Para logs
- `idx_hotmart_webhook_logs_customer_email` - Para logs
- `idx_hotmart_webhook_logs_created_at` - Para logs
- `idx_hotmart_webhook_logs_processing_success` - Para logs

## Verificação

Após aplicar a migration, verifique se os campos foram criados:

```sql
-- Verificar campos na tabela orders
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name LIKE 'hotmart%';

-- Verificar se a tabela hotmart_webhook_logs existe
SELECT * FROM hotmart_webhook_logs LIMIT 1;
```

## Próximos passos após migration

1. ✅ Configurar webhook na interface da Hotmart:
   - URL: `https://musiclovelybackend-production.up.railway.app/api/hotmart/webhook`
   - Token: Usar o valor de `HOTMART_WEBHOOK_SECRET`

2. ✅ Configurar variáveis de ambiente na Railway:
   - `HOTMART_WEBHOOK_SECRET` (já configurado)

3. ✅ Testar o fluxo completo:
   - Criar pedido no domínio `.com.br` (deve usar Hotmart)
   - Verificar redirecionamento para Hotmart
   - Simular webhook ou aguardar pagamento real
   - Verificar se pedido é marcado como pago
