# 🧪 Guia de Testes - Integração Hotmart

## Pré-requisitos

✅ Migration aplicada no banco de dados  
✅ `HOTMART_WEBHOOK_SECRET` configurado no Supabase  
✅ Webhook configurado na interface da Hotmart  
✅ Backend Railway rodando  

---

## 1. Teste de Redirecionamento (Frontend)

### Objetivo
Verificar se o checkout redireciona corretamente para Hotmart quando acessado via domínio `.com.br`.

### Passos

1. **Acesse o checkout via domínio `.com.br`:**
   ```
   https://musiclovely.com.br/checkout
   ```
   ou
   ```
   https://www.musiclovely.com.br/checkout
   ```

2. **Preencha o formulário:**
   - Email: use um email de teste
   - WhatsApp: número válido
   - Complete o quiz

3. **Clique em "Finalizar Compra"**

4. **Verifique:**
   - ✅ Deve redirecionar para `https://pay.hotmart.com/O103476976K`
   - ✅ URL deve conter parâmetros: `email`, `phone`, `order_id`
   - ✅ Não deve redirecionar para Cakto

### Teste Local (localhost)

Para testar localmente, você pode simular o domínio:

1. **Edite o arquivo `hosts` do Windows:**
   ```
   C:\Windows\System32\drivers\etc\hosts
   ```

2. **Adicione:**
   ```
   127.0.0.1 musiclovely.com.br
   ```

3. **Acesse:**
   ```
   http://musiclovely.com.br:5173/checkout
   ```

---

## 2. Teste de Criação de Pedido

### Objetivo
Verificar se o pedido é criado corretamente com `provider: 'hotmart'`.

### Passos

1. **Complete o checkout até o redirecionamento**

2. **Verifique no banco de dados:**
   ```sql
   SELECT 
     id,
     customer_email,
     provider,
     status,
     hotmart_payment_url,
     created_at
   FROM orders
   WHERE provider = 'hotmart'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Verifique:**
   - ✅ `provider` = `'hotmart'`
   - ✅ `status` = `'pending'`
   - ✅ `hotmart_payment_url` não está vazio
   - ✅ URL contém `pay.hotmart.com`

---

## 3. Teste de Webhook (Simulação)

### Objetivo
Testar se o endpoint do webhook processa corretamente os eventos da Hotmart.

### Opção A: Usar Postman/Insomnia

1. **Configure a requisição:**
   - **Método:** `POST`
   - **URL:** `https://musiclovelybackend-production.up.railway.app/api/hotmart/webhook`
   - **Headers:**
     ```
     Content-Type: application/json
     Authorization: Bearer YHL1bMkqcTJfClEkt2ex9VoBWmoHj896488a25-bf5f-4f11-82b5-c0d119c4a98c
     ```
     ou
     ```
     X-HOTMART-TOKEN: YHL1bMkqcTJfClEkt2ex9VoBWmoHj896488a25-bf5f-4f11-82b5-c0d119c4a98c
     ```

2. **Body (JSON):**
   ```json
   {
     "event": "PURCHASE_APPROVED",
     "data": {
       "purchase": {
         "transaction": "H123456789",
         "order": {
           "id": "ORDER123"
         },
         "buyer": {
           "email": "teste@email.com",
           "phone": "5511999999999",
           "name": "Nome do Teste"
         },
         "price": {
           "value": 47.90,
           "currency_code": "BRL"
         },
         "approved_date": "2026-01-15T10:00:00Z"
       }
     }
   }
   ```

3. **Substitua `teste@email.com` pelo email do pedido criado no passo 2**

4. **Envie a requisição**

5. **Verifique a resposta:**
   - ✅ Status: `200 OK`
   - ✅ Body deve conter: `{ "success": true, "order_id": "..." }`

### Opção B: Usar cURL

```bash
curl -X POST https://musiclovelybackend-production.up.railway.app/api/hotmart/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YHL1bMkqcTJfClEkt2ex9VoBWmoHj896488a25-bf5f-4f11-82b5-c0d119c4a98c" \
  -d '{
    "event": "PURCHASE_APPROVED",
    "data": {
      "purchase": {
        "transaction": "H123456789",
        "buyer": {
          "email": "teste@email.com",
          "phone": "5511999999999"
        },
        "price": {
          "value": 47.90
        }
      }
    }
  }'
```

---

## 4. Verificação de Pedido Marcado como Pago

### Objetivo
Verificar se o pedido foi atualizado corretamente após o webhook.

### Passos

1. **Após enviar o webhook, verifique no banco:**
   ```sql
   SELECT 
     id,
     customer_email,
     provider,
     status,
     hotmart_transaction_id,
     hotmart_payment_status,
     paid_at,
     updated_at
   FROM orders
   WHERE customer_email = 'teste@email.com'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **Verifique:**
   - ✅ `status` = `'paid'`
   - ✅ `hotmart_transaction_id` = `'H123456789'` (ou o transaction_id enviado)
   - ✅ `hotmart_payment_status` = `'approved'`
   - ✅ `paid_at` não está vazio

---

## 5. Verificação de Logs

### Objetivo
Verificar se os logs do webhook foram salvos corretamente.

### Passos

1. **Verifique a tabela `hotmart_webhook_logs`:**
   ```sql
   SELECT 
     id,
     transaction_id,
     customer_email,
     order_found,
     processing_success,
     strategy_used,
     processing_time_ms,
     created_at
   FROM hotmart_webhook_logs
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Verifique:**
   - ✅ `order_found` = `true`
   - ✅ `processing_success` = `true`
   - ✅ `strategy_used` não está vazio (ex: `'email_most_recent'` ou `'hotmart_transaction_id'`)

---

## 6. Verificação de Email de Confirmação

### Objetivo
Verificar se o email de confirmação foi enviado.

### Passos

1. **Verifique a tabela `email_logs`:**
   ```sql
   SELECT 
     id,
     order_id,
     email_type,
     status,
     recipient_email,
     sent_at,
     created_at
   FROM email_logs
   WHERE email_type = 'order_paid'
   AND order_id = 'UUID_DO_PEDIDO'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **Verifique:**
   - ✅ `email_type` = `'order_paid'`
   - ✅ `status` = `'sent'` ou `'delivered'`
   - ✅ `recipient_email` = email do pedido

---

## 7. Teste de Idempotência

### Objetivo
Verificar se o webhook não processa o mesmo pedido duas vezes.

### Passos

1. **Envie o mesmo webhook duas vezes** (mesmo `transaction_id` e `email`)

2. **Verifique:**
   - ✅ Primeira requisição: `status` = `'paid'`
   - ✅ Segunda requisição: resposta `{ "received": true, "message": "Already processed" }`
   - ✅ Apenas 1 email foi enviado (verificar `email_logs`)

---

## 8. Verificação de Logs do Backend (Railway)

### Objetivo
Verificar se há erros nos logs do backend.

### Passos

1. **Acesse o dashboard da Railway:**
   - Vá em **Deployments** → Selecione o deployment mais recente
   - Clique em **View Logs**

2. **Procure por:**
   - ✅ `🔔 [Hotmart Webhook] WEBHOOK RECEBIDO`
   - ✅ `✅ [Hotmart Webhook] Token válido`
   - ✅ `✅ [Hotmart Webhook] Pedido marcado como pago!`
   - ❌ Não deve haver erros de validação ou processamento

---

## 9. Teste End-to-End Completo

### Objetivo
Testar o fluxo completo desde o checkout até a confirmação.

### Passos

1. **Acesse:** `https://musiclovely.com.br/checkout`
2. **Complete o formulário** com dados reais
3. **Redirecione para Hotmart** e complete o pagamento (ou use modo sandbox/teste)
4. **Aguarde o webhook** ser enviado pela Hotmart (pode levar alguns segundos)
5. **Verifique:**
   - ✅ Pedido marcado como pago
   - ✅ Email de confirmação enviado
   - ✅ Letra gerada automaticamente (se aplicável)

---

## Troubleshooting

### Problema: Redirecionamento não funciona

**Verifique:**
- ✅ Domínio está correto (`.com.br` para Hotmart, `.com` para Cakto)
- ✅ Console do navegador não mostra erros
- ✅ `getPaymentGateway()` está retornando `'hotmart'`

**Debug:**
```javascript
// No console do navegador
console.log('Gateway:', getPaymentGateway());
console.log('Hostname:', window.location.hostname);
```

### Problema: Webhook retorna 401 (Unauthorized)

**Verifique:**
- ✅ Token está correto: `YHL1bMkqcTJfClEkt2ex9VoBWmoHj896488a25-bf5f-4f11-82b5-c0d119c4a98c`
- ✅ Header `Authorization` ou `X-HOTMART-TOKEN` está sendo enviado
- ✅ `HOTMART_WEBHOOK_SECRET` está configurado na Railway

### Problema: Pedido não é encontrado

**Verifique:**
- ✅ Email no webhook corresponde ao email do pedido
- ✅ Pedido foi criado com `provider: 'hotmart'`
- ✅ Pedido está com `status: 'pending'`

**Debug:**
```sql
-- Verificar pedidos recentes
SELECT id, customer_email, provider, status, created_at
FROM orders
WHERE customer_email = 'EMAIL_DO_TESTE'
ORDER BY created_at DESC;
```

### Problema: Email não é enviado

**Verifique:**
- ✅ Edge function `notify-payment-webhook` está funcionando
- ✅ Verificar logs do Supabase Functions
- ✅ Verificar se há email_logs com status `'pending'` há muito tempo

---

## Checklist Final

- [ ] Redirecionamento funciona para Hotmart (`.com.br`)
- [ ] Pedido criado com `provider: 'hotmart'`
- [ ] Webhook recebe e processa corretamente
- [ ] Pedido marcado como `'paid'`
- [ ] `hotmart_transaction_id` salvo
- [ ] Logs salvos em `hotmart_webhook_logs`
- [ ] Email de confirmação enviado
- [ ] Idempotência funciona (não processa duas vezes)
- [ ] Logs do backend sem erros

---

## Próximos Passos

Após todos os testes passarem:

1. ✅ Configurar webhook na interface da Hotmart (se ainda não configurou)
2. ✅ Fazer um teste com pagamento real (sandbox/teste)
3. ✅ Monitorar logs nas primeiras 24h
4. ✅ Verificar se há algum problema de performance
