# Edge Function: notify-payment-webhook

## Problema Identificado
A Edge Function `notify-payment-webhook` está sendo chamada e pode estar enviando emails duplicados.

## Solução Implementada

Foi criado um arquivo de exemplo em `supabase/functions/notify-payment-webhook/index.ts` com as seguintes verificações de idempotência:

### 1. Verificação de Email Já Enviado
- Verifica se já existe um email de confirmação (`order_paid`) enviado para o pedido
- Verifica status: `sent`, `delivered`, ou `pending`
- Se encontrar, retorna imediatamente sem enviar email novamente

### 2. Verificação de Processamento em Andamento
- Verifica se há emails com status `pending` criados nos últimos 5 segundos
- Evita race conditions quando múltiplas chamadas chegam simultaneamente
- Se encontrar, retorna imediatamente sem enviar email novamente

### 3. Validações Adicionais
- Verifica se o pedido existe
- Verifica se o pedido está com status `paid`
- Verifica se o pedido tem email do cliente

## Como Aplicar

1. **Acesse o Supabase Dashboard**
2. **Vá para Edge Functions**
3. **Encontre ou crie a função `notify-payment-webhook`**
4. **Substitua o código pelo conteúdo de `supabase/functions/notify-payment-webhook/index.ts`**

## Verificações de Idempotência

A função agora tem duas camadas de proteção:

1. **Verificação prévia**: Antes de enviar qualquer email, verifica se já foi enviado
2. **Verificação de processamento**: Verifica se há outro processo em andamento

## Logs

A função inclui logs detalhados para rastreamento:
- Log quando email já foi enviado (com detalhes do registro)
- Log quando email está em processamento
- Log quando email é enviado com sucesso
- Log de erros com detalhes

## Possíveis Causas de Duplicação

Se ainda houver duplicação após aplicar esta correção, verifique:

1. **Triggers do Banco de Dados**: 
   - O trigger `trigger_complete_payment_flow` pode estar chamando esta função
   - Verifique se há outros triggers que enviam emails

2. **Múltiplas Chamadas do Webhook**:
   - O webhook do Cakto pode estar sendo chamado duas vezes
   - A verificação no `payment.ts` já trata isso parcialmente

3. **A Função `send-email-with-variables`**:
   - Pode estar enviando emails duplicados internamente
   - Verifique se ela também tem verificação de idempotência

## Próximos Passos

1. Aplicar o código da Edge Function no Supabase
2. Monitorar logs para confirmar que não há mais duplicação
3. Se necessário, verificar e corrigir a função `send-email-with-variables`
