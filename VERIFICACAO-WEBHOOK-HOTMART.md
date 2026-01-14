# Verificação: Sistema de Webhook Hotmart

## Status Geral: ✅ **IMPLEMENTADO, MAS REQUER VERIFICAÇÕES**

O sistema possui a implementação completa do webhook da Hotmart, mas é necessário verificar alguns pontos antes de considerar 100% pronto.

---

## ✅ O que está implementado:

### 1. **Migration do Banco de Dados**
- ✅ Arquivo: `supabase/migrations/add_hotmart_support.sql`
- ✅ Campos adicionados na tabela `orders`:
  - `hotmart_payment_url` (TEXT)
  - `hotmart_transaction_id` (TEXT)
  - `hotmart_payment_status` (TEXT)
- ✅ Tabela `hotmart_webhook_logs` criada para logs
- ✅ Índices criados para performance

### 2. **Rota de Webhook**
- ✅ Endpoint: `POST /api/hotmart/webhook`
- ✅ Implementado em: `src/routes/payment.ts` (linhas 996-1557)
- ✅ Implementado em: `backend/src/routes/payment.ts` (linhas 587-1002)
- ✅ **SINCRONIZADO**: Ambas as versões estão sincronizadas com a implementação mais completa
- ✅ Rota registrada no Fastify (`backend/src/index.ts`)

### 3. **Funcionalidades Implementadas**

#### Autenticação
- ✅ Validação de token via `HOTMART_WEBHOOK_SECRET`
- ✅ Suporte para token em `Authorization: Bearer`, `x-hotmart-token` ou no body
- ✅ Suporte para chamadas internas (usando service key)

#### Processamento de Webhook
- ✅ Extração de dados do payload da Hotmart:
  - Transaction ID
  - Email do comprador
  - Telefone do comprador
  - Valor da compra
  - Data de aprovação
  - Status do evento

#### Estratégias de Busca de Pedido
1. **hotmart_transaction_id** (mais confiável)
2. **email_most_recent** (pedido mais recente pendente com mesmo email)
3. **phone_most_recent** (pedido mais recente pendente com mesmo telefone)

#### Atualização de Pedido
- ✅ Marca pedido como `paid`
- ✅ Atualiza `hotmart_payment_status` para `approved`
- ✅ Salva `hotmart_transaction_id`
- ✅ Define `provider` como `hotmart`
- ✅ Atualiza `paid_at` com timestamp

#### Idempotência
- ✅ Verifica se pedido já está pago antes de processar
- ✅ **NÃO retorna early se pedido já está pago** - garante que letras sejam geradas mesmo em retentativas
- ✅ Verifica se approval já existe antes de gerar letras
- ✅ Evita envio duplicado de emails
- ✅ Evita geração duplicada de letras

#### Integrações Automáticas
- ✅ Envio de email de confirmação via `notify-payment-webhook`
- ✅ Geração automática de letras via `generate-lyrics-for-approval`
- ✅ Criação automática de job se necessário via função `ensureJobExists`
- ✅ Retry automático (até 3 tentativas) para geração de letras
- ✅ Logs detalhados em cada etapa do processo

#### Logging
- ✅ Logs detalhados em `hotmart_webhook_logs`
- ✅ Logs de console para debugging
- ✅ Rastreamento de estratégia usada
- ✅ Medição de tempo de processamento

---

## ⚠️ Verificações Necessárias:

### 1. **Migration Aplicada?**
Verifique se a migration foi aplicada no banco de dados:

```sql
-- Verificar campos na tabela orders
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name LIKE 'hotmart%';

-- Verificar se a tabela hotmart_webhook_logs existe
SELECT * FROM hotmart_webhook_logs LIMIT 1;
```

**Se os campos não existirem**, execute:
```bash
# Via Supabase CLI
supabase db push

# OU via Supabase Dashboard
# Cole o conteúdo de supabase/migrations/add_hotmart_support.sql no SQL Editor
```

### 2. **Variável de Ambiente Configurada?**
Verifique se `HOTMART_WEBHOOK_SECRET` está configurada:

```bash
# No Railway ou onde o backend está hospedado
echo $HOTMART_WEBHOOK_SECRET
```

**Se não estiver configurada**, adicione:
- No Railway: Vá em Variables e adicione `HOTMART_WEBHOOK_SECRET` com o valor do token da Hotmart

### 3. **URL do Webhook Configurada na Hotmart?**
Configure o webhook na interface da Hotmart:
- **URL**: `https://musiclovelybackend-production.up.railway.app/api/hotmart/webhook`
- **Token**: O valor de `HOTMART_WEBHOOK_SECRET`
- **Eventos**: `purchase.approved`, `purchase.cancelled`, `purchase.chargeback`

### 4. **Teste do Webhook**
Após configurar tudo, teste com um pedido real ou use a ferramenta de teste da Hotmart.

---

## 📋 Checklist Final:

- [ ] Migration aplicada no banco de dados
- [ ] `HOTMART_WEBHOOK_SECRET` configurada no ambiente
- [ ] Webhook configurado na interface da Hotmart
- [ ] URL do webhook acessível publicamente
- [ ] Teste realizado com pedido real

---

## 🔍 Como Testar:

### 1. Verificar se a rota está acessível:
```bash
curl -X POST https://musiclovelybackend-production.up.railway.app/api/hotmart/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"test": "payload"}'
```

### 2. Verificar logs após um webhook:
```sql
SELECT * FROM hotmart_webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Verificar pedidos atualizados:
```sql
SELECT id, status, provider, hotmart_transaction_id, hotmart_payment_status, paid_at
FROM orders 
WHERE provider = 'hotmart' 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## 📝 Observações Importantes:

1. **Estrutura do Payload**: O código espera o payload no formato:
   ```json
   {
     "event": "purchase.approved",
     "data": {
       "purchase": {
         "transaction": "TRANSACTION_ID",
         "buyer": {
           "email": "email@example.com",
           "phone": "+5511999999999"
         },
         "price": {
           "value": 97.00
         },
         "approved_date": "2024-01-15T10:30:00Z"
       }
     }
   }
   ```

2. **Validação de Email**: Se a estratégia usada for `email_most_recent`, o sistema valida se o email corresponde ao pedido encontrado.

3. **Geração de Letras**: O sistema tenta gerar letras automaticamente até 3 vezes com retry exponencial.

4. **Idempotência**: O sistema é idempotente - múltiplos webhooks para o mesmo pedido não causam problemas.

---

## 🚨 Possíveis Problemas:

1. **Pedido não encontrado**: 
   - Verifique se o pedido foi criado com `provider: 'hotmart'`
   - Verifique se o email/telefone corresponde

2. **Token inválido**:
   - Verifique se `HOTMART_WEBHOOK_SECRET` está correto
   - Verifique se a Hotmart está enviando o token no header correto

3. **Migration não aplicada**:
   - Execute a migration manualmente se necessário
   - Verifique se os campos existem no banco

---

## ✅ Conclusão:

O sistema **está pronto** para receber webhooks da Hotmart, mas você precisa:

1. ✅ Aplicar a migration (se ainda não foi aplicada)
2. ✅ Configurar `HOTMART_WEBHOOK_SECRET` no ambiente
3. ✅ Configurar o webhook na interface da Hotmart
4. ✅ Testar com um pedido real

Após essas verificações, o sistema estará 100% operacional! 🎉

---

## 🔄 Sincronização de Código:

### Status da Sincronização: ✅ **SINCRONIZADO**

As duas versões do webhook da Hotmart foram sincronizadas:

- **`src/routes/payment.ts`**: Versão principal (usada em desenvolvimento)
- **`backend/src/routes/payment.ts`**: Versão do backend (usada em produção)

### Melhorias Aplicadas na Sincronização:

1. **Função `ensureJobExists` adicionada ao backend**
   - Garante que um job existe antes de gerar letras
   - Cria o job automaticamente se não existir

2. **Correção crítica: Não retornar early se pedido já está pago**
   - Versão antiga retornava early se pedido já estava pago
   - Versão nova continua o processamento para garantir geração de letras
   - Isso resolve casos onde letras não eram geradas em retentativas

3. **Verificação de approval existente**
   - Verifica se já existe um `lyrics_approval` antes de gerar letras
   - Evita geração duplicada de letras

4. **Logs mais detalhados**
   - Logs em cada etapa do processo
   - Timestamps em todas as operações
   - Melhor rastreabilidade de erros

5. **Retry melhorado**
   - Logs detalhados em cada tentativa
   - Delay exponencial entre tentativas
   - Melhor tratamento de erros

### Diferenças Removidas:

- ❌ **Removido**: Retorno early quando pedido já está pago (linha 840-846 da versão antiga)
- ✅ **Adicionado**: Verificação de `wasAlreadyPaid` com continuação do processamento
- ✅ **Adicionado**: Verificação de approval existente antes de gerar letras
- ✅ **Adicionado**: Função `ensureJobExists` para garantir que job existe

### Arquivos Modificados:

- `backend/src/routes/payment.ts`: Sincronizado com versão mais completa
- `VERIFICACAO-WEBHOOK-HOTMART.md`: Atualizado com informações sobre sincronização
