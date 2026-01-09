# Análise de Triggers do Banco de Dados

## Triggers Identificados

Baseado na imagem fornecida, os seguintes triggers podem estar relacionados ao envio de emails:

### Triggers UPDATE na tabela `orders`:

1. **`trigger_complete_payment_flow`** ⚠️ **CRÍTICO**
   - Evento: `UPDATE`
   - Tabela: `orders`
   - **Este trigger pode estar chamando a função de envio de email quando o status muda para 'paid'**

2. **`trigger_auto_move_email_funnel_to_completed`**
   - Evento: `UPDATE`
   - Tabela: `orders`
   - Pode estar relacionado ao sistema de funil de emails

3. **`trigger_auto_mark_cakto_paid`**
   - Evento: `UPDATE`
   - Tabela: `orders`
   - Pode estar marcando pedidos como pagos e disparando emails

4. **`trigger_sync_funnel_order_status`**
   - Evento: `UPDATE`
   - Tabela: `orders`
   - Pode estar sincronizando status e disparando ações

## Como Verificar e Corrigir

### 1. Verificar o Código dos Triggers

Execute no Supabase SQL Editor:

```sql
-- Ver o código do trigger_complete_payment_flow
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_complete_payment_flow';

-- Ver todos os triggers relacionados a orders
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders'
  AND event_manipulation = 'UPDATE';
```

### 2. Verificar se os Triggers Estão Chamando Funções de Email

Procure por chamadas a:
- `notify-payment-webhook`
- `send-email-with-variables`
- Funções que inserem em `email_logs`
- Funções que enviam emails via Resend

### 3. Solução Recomendada

**Opção A: Adicionar Verificação de Idempotência nos Triggers**

Modifique os triggers para verificar se o email já foi enviado antes de chamar a função:

```sql
-- Exemplo de trigger com verificação de idempotência
CREATE OR REPLACE FUNCTION check_and_send_payment_email()
RETURNS TRIGGER AS $$
DECLARE
  email_exists BOOLEAN;
BEGIN
  -- Só processar se status mudou para 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    
    -- Verificar se email já foi enviado
    SELECT EXISTS(
      SELECT 1 FROM email_logs
      WHERE order_id = NEW.id
        AND email_type = 'order_paid'
        AND status IN ('sent', 'delivered', 'pending')
    ) INTO email_exists;
    
    -- Só chamar função se email não foi enviado
    IF NOT email_exists THEN
      -- Chamar Edge Function ou função de envio de email
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/notify-payment-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
        ),
        body := jsonb_build_object('order_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Opção B: Desabilitar Triggers Temporariamente**

Se os triggers estiverem causando duplicação, você pode desabilitá-los temporariamente:

```sql
-- Desabilitar trigger específico
ALTER TABLE orders DISABLE TRIGGER trigger_complete_payment_flow;

-- Reabilitar quando necessário
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;
```

**Opção C: Remover Chamadas de Email dos Triggers**

Se o webhook já está enviando o email, remova a chamada de email dos triggers e deixe apenas o webhook fazer isso.

## Próximos Passos

1. **Verificar o código dos triggers** usando o SQL acima
2. **Identificar qual trigger está enviando emails**
3. **Adicionar verificação de idempotência** no trigger identificado
4. **Testar** com um pedido de teste
5. **Monitorar logs** para confirmar que não há mais duplicação

## Triggers que Precisam de Atenção

Baseado na lista de triggers, os seguintes precisam ser verificados:

1. ✅ `trigger_complete_payment_flow` - **PRIORIDADE ALTA**
2. ✅ `trigger_auto_move_email_funnel_to_completed` - **PRIORIDADE MÉDIA**
3. ✅ `trigger_auto_mark_cakto_paid` - **PRIORIDADE MÉDIA**
4. ✅ `trigger_sync_funnel_order_status` - **PRIORIDADE BAIXA**

## Nota Importante

Se houver um trigger chamando `notify-payment-webhook` E o webhook também chamando, isso explicaria a duplicação. A solução é:

1. **Deixar apenas UMA fonte de envio de email** (recomendado: webhook)
2. **OU adicionar verificação de idempotência em ambas as fontes** (já implementado no webhook e na Edge Function)
