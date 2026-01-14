# Correção: Geração Automática de Letras quando Pedido é Pago

## Problema Identificado

Quando um pedido era marcado como `paid`, o job não estava sendo criado automaticamente para gerar a letra. Isso impedia que o processo de geração de letras fosse iniciado automaticamente após o pagamento.

## Solução Implementada

Foi criada uma função do banco de dados (`create_job_on_payment()`) e um trigger (`trigger_create_job_on_payment`) que:

1. **Detecta automaticamente** quando um pedido muda para status `paid`
2. **Verifica idempotência** para evitar criar jobs duplicados
3. **Cria um novo job** com status `pending` se não existir
4. **Valida** se o pedido tem `quiz_id` (obrigatório para criar job)

## Arquivos Criados

### 1. Migration SQL
**Arquivo**: `supabase/migrations/create_job_on_payment_trigger.sql`

Contém:
- Função `create_job_on_payment()` que cria o job automaticamente quando pedido é pago
- Trigger `trigger_create_job_on_payment` que dispara após UPDATE em `orders`
- Verificações de idempotência para evitar jobs duplicados
- Comentários de documentação

**Nota**: A função apenas cria o job. A chamada da Edge Function `generate-lyrics-for-approval` é feita pelo webhook (`src/routes/payment.ts`), que já está implementado.

### 2. Script de Verificação
**Arquivo**: `scripts/verify-job-creation-trigger.sql`

Script SQL para verificar:
- Se a função e trigger foram criados corretamente
- Se o trigger está habilitado
- Pedidos pagos sem jobs (indicam problema)
- Jobs duplicados (não deveria acontecer)

## Como Aplicar a Migration

### Passo 1: Aplicar Migration Principal

#### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o Supabase Dashboard → **SQL Editor**
2. Abra o arquivo `supabase/migrations/create_job_on_payment_trigger.sql`
3. Cole o conteúdo completo no editor
4. Execute a query
5. Verifique se não houve erros

#### Opção 2: Via Supabase CLI

```bash
supabase db push
```

## Verificação Pós-Migration

Após aplicar a migration, execute o script de verificação:

1. Acesse o Supabase Dashboard → SQL Editor
2. Abra o arquivo `scripts/verify-job-creation-trigger.sql`
3. Execute todas as queries
4. Verifique os resultados:
   - ✅ Trigger deve estar **HABILITADO**
   - ✅ Não deve haver pedidos pagos sem jobs (query 3)
   - ✅ Não deve haver jobs duplicados (query 5)

## Como Funciona

### Fluxo de Execução

1. **Webhook de Pagamento** (`src/routes/payment.ts`) recebe confirmação de pagamento
2. **Webhook atualiza** o status do pedido para `paid`
3. **Trigger dispara** automaticamente após o UPDATE
4. **Função do banco verifica**:
   - Se o pedido tem `quiz_id` (obrigatório)
   - Se já existe um job para esse `order_id` (idempotência)
5. **Se tudo OK**: Cria novo job com status `pending`
6. **Webhook chama** a Edge Function `generate-lyrics-for-approval` para iniciar a geração de letras
7. **Sistema de geração de letras** processa o job automaticamente

### Chamada da Edge Function

A chamada da Edge Function `generate-lyrics-for-approval` é feita pelo **webhook** (`src/routes/payment.ts`), não pelo trigger do banco de dados. Isso é mais confiável e não requer permissões especiais.

O webhook já está configurado para chamar a Edge Function após marcar o pedido como pago (linhas 622-648 do arquivo `src/routes/payment.ts`).

### Verificações de Segurança

- ✅ **Idempotência**: Não cria jobs duplicados
- ✅ **Validação**: Verifica se pedido tem `quiz_id`
- ✅ **Logs**: Registra avisos e notificações para debugging

## Teste Manual

Para testar manualmente:

1. **Criar um pedido de teste** com `quiz_id` e status `pending`
2. **Atualizar o status** para `paid`:
   ```sql
   UPDATE orders 
   SET status = 'paid', paid_at = NOW() 
   WHERE id = 'SEU_ORDER_ID';
   ```
3. **Verificar se o job foi criado**:
   ```sql
   SELECT * FROM jobs WHERE order_id = 'SEU_ORDER_ID';
   ```
4. **Verificar logs** do banco de dados para mensagens do trigger

## Monitoramento

Após aplicar a migration, monitore:

1. **Logs do banco de dados** para mensagens do trigger
2. **Pedidos pagos sem jobs** (query 3 do script de verificação)
3. **Jobs duplicados** (query 5 do script de verificação)
4. **Taxa de sucesso** de criação automática de jobs

## Troubleshooting

### Problema: Job não está sendo criado

**Possíveis causas**:
1. Trigger está desabilitado
2. Pedido não tem `quiz_id`
3. Já existe um job para esse pedido (comportamento esperado)

**Solução**:
1. Execute o script de verificação
2. Verifique se o trigger está habilitado
3. Verifique se o pedido tem `quiz_id`
4. Verifique logs do banco de dados

### Problema: Jobs duplicados sendo criados

**Possíveis causas**:
1. Trigger sendo executado múltiplas vezes
2. Race condition (improvável com a verificação de idempotência)

**Solução**:
1. Execute a query 5 do script de verificação
2. Se encontrar duplicados, verifique os logs
3. A verificação de idempotência deve prevenir isso

## Próximos Passos

1. ✅ Aplicar a migration no banco de dados de produção
2. ✅ Executar o script de verificação
3. ✅ Monitorar por alguns dias
4. ✅ Verificar se novos pedidos pagos estão gerando jobs automaticamente

## Notas Importantes

- ⚠️ A função requer que o pedido tenha `quiz_id` para criar o job
- ⚠️ Se o pedido não tiver `quiz_id`, um aviso será registrado nos logs
- ✅ A verificação de idempotência previne criação de jobs duplicados
- ✅ O trigger só dispara quando o status muda de qualquer valor para `paid`

## Arquivos Relacionados

- `supabase/migrations/create_job_on_payment_trigger.sql` - Migration principal
- `scripts/verify-job-creation-trigger.sql` - Script de verificação
- `src/routes/payment.ts` - Webhook de pagamento que atualiza status
- `DATABASE_TRIGGERS_ANALYSIS.md` - Análise de triggers existentes
