# Correção: Geração Automática de Letras nos Webhooks

## Problema Identificado

A função `generate-lyrics-for-approval` não estava sendo chamada automaticamente após o pagamento porque:

1. **Early Return**: Quando um pedido já estava com status `paid`, o webhook retornava imediatamente sem chamar a função
2. **Falta de Verificação de Idempotência**: Não verificava se já existia approval antes de tentar gerar
3. **Logs Insuficientes**: Não havia logs detalhados para debug

## Correções Aplicadas

### 1. Removido Early Return (Cakto e Hotmart)

**Antes:**
```typescript
if (order.status === 'paid') {
  return reply.code(200).send({ received: true, message: 'Already processed' });
}
```

**Depois:**
```typescript
const wasAlreadyPaid = order.status === 'paid';
// Continua processamento mesmo se já estiver pago
```

### 2. Adicionada Verificação de Idempotência

Agora o webhook verifica:
- Se já existe `lyrics_approval` → Pula geração (já foi gerada)
- Se existe `job` mas não `approval` → Gera letra (job existe mas letra não foi gerada)
- Se não existe nem `job` nem `approval` → Gera letra

### 3. Logs Detalhados

Adicionados logs em cada etapa:
- Verificação de jobs/approvals existentes
- Chamada da Edge Function
- Sucesso/erro na geração
- Tentativas de retry

### 4. Melhor Tratamento de Erros

- Retry automático (3 tentativas)
- Logs detalhados de erros
- Continua processamento mesmo com erros de verificação

## Arquivos Modificados

- `src/routes/payment.ts`:
  - Webhook Cakto (linhas 304-720)
  - Webhook Hotmart (linhas 1117-1320)

## Fluxo Corrigido

1. **Webhook recebe pagamento**
2. **Atualiza status para `paid`** (mesmo que já esteja pago)
3. **Trigger do banco cria job automaticamente** (via `trigger_create_job_on_payment`)
4. **Webhook verifica se precisa gerar letra**:
   - Se já existe approval → Pula
   - Se não existe approval → Chama `generate-lyrics-for-approval`
5. **Edge Function gera letra automaticamente**

## Como Testar

1. Fazer um pagamento de teste
2. Verificar logs do webhook (Railway/Vercel)
3. Verificar se job foi criado:
   ```sql
   SELECT * FROM jobs WHERE order_id = 'SEU_ORDER_ID';
   ```
4. Verificar se approval foi criada:
   ```sql
   SELECT * FROM lyrics_approvals WHERE order_id = 'SEU_ORDER_ID';
   ```

## Logs Esperados

Ao processar um pagamento, você deve ver nos logs:

```
🎵 [Cakto Webhook] Chamando generate-lyrics-for-approval para gerar letra...
✅ [Cakto Webhook] Letra sendo gerada com sucesso
```

Ou, se já existe approval:

```
ℹ️ [Cakto Webhook] Approval já existe - pulando geração de letra
```

## Importante

- ✅ A função **sempre será chamada** quando um pedido é pago (exceto se já existe approval)
- ✅ Verificação de idempotência previne gerações duplicadas
- ✅ Logs detalhados facilitam debug
- ✅ Funciona para **Cakto** e **Hotmart**

## Próximos Passos

1. Fazer deploy das alterações
2. Testar com um pagamento real
3. Monitorar logs para confirmar que está funcionando
4. Verificar se letras estão sendo geradas automaticamente
