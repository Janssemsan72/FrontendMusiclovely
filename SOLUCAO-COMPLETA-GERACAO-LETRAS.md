# Solução Completa: Geração Automática de Letras

## Problema Identificado

O job é criado automaticamente quando o pedido é pago, mas a letra **não está sendo gerada automaticamente**. O problema está nas **Edge Functions e banco de dados**.

## Análise do Fluxo

### Fluxo Esperado:
1. ✅ Webhook marca pedido como `paid`
2. ✅ Trigger do banco cria job automaticamente
3. ❌ Edge Function `generate-lyrics-for-approval` deveria criar a approval e gerar letra
4. ❌ Approval não está sendo criada

### Problema:
A Edge Function `generate-lyrics-for-approval` não está sendo chamada corretamente ou não está funcionando.

## Soluções Implementadas

### Solução 1: Trigger no Banco que Chama Edge Function (RECOMENDADO)

**Arquivo**: `supabase/migrations/ensure_lyrics_generation_on_job_creation.sql`

Cria um trigger na tabela `jobs` que:
- Dispara quando um job é criado com status `pending`
- Verifica se o pedido está pago
- Verifica se já existe approval (idempotência)
- Tenta chamar a Edge Function `generate-lyrics-for-approval` via `pg_net`

**Vantagens**:
- Funciona automaticamente quando job é criado
- Não depende do webhook
- Verifica idempotência

**Requisitos**:
- Extensão `pg_net` habilitada (opcional - se não tiver, o webhook ainda chama)
- Variáveis `app.supabase_url` e `app.supabase_service_key` configuradas (opcional)

### Solução 2: Função Auxiliar para Processar Jobs Pendentes

**Arquivo**: `supabase/migrations/function_process_pending_jobs_without_approval.sql`

Função que pode ser chamada manualmente para processar jobs pendentes sem approval:
```sql
SELECT * FROM process_pending_jobs_without_approval();
```

**Uso**:
- Pode ser chamada manualmente quando necessário
- Pode ser configurada em um cron job para rodar periodicamente
- Processa até 50 jobs por vez

## Como Aplicar

### Passo 1: Aplicar Migration do Trigger (Recomendado)

1. Acesse **Supabase Dashboard → SQL Editor**
2. Execute: `supabase/migrations/ensure_lyrics_generation_on_job_creation.sql`
3. Verifique se não houve erros

**Nota**: Se `pg_net` não estiver disponível ou variáveis não estiverem configuradas, o trigger ainda funcionará mas não chamará a Edge Function. Nesse caso, o webhook continuará chamando (redundância).

### Passo 2: (Opcional) Aplicar Função Auxiliar

1. Execute: `supabase/migrations/function_process_pending_jobs_without_approval.sql`
2. Use para processar jobs pendentes manualmente:
   ```sql
   SELECT * FROM process_pending_jobs_without_approval();
   ```

### Passo 3: Verificar se Funcionou

Execute esta query para verificar se o trigger foi criado:

```sql
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE 
    WHEN t.tgenabled = 'D' THEN 'DESABILITADO ⚠️'
    WHEN t.tgenabled = 'O' THEN 'HABILITADO ✅'
    WHEN t.tgenabled = 'A' THEN 'HABILITADO ✅'
    ELSE 'STATUS: ' || t.tgenabled::text
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'jobs'
  AND t.tgname = 'trigger_ensure_lyrics_generation_on_job_creation';
```

### Passo 4: Processar Jobs Pendentes Existentes

Se houver jobs pendentes sem approval, execute:

```sql
-- Ver quantos jobs precisam ser processados
SELECT 
  COUNT(*) as total_jobs_pendentes_sem_approval
FROM jobs j
INNER JOIN orders o ON j.order_id = o.id
WHERE j.status = 'pending'
  AND o.status = 'paid'
  AND o.quiz_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lyrics_approvals la 
    WHERE la.order_id = j.order_id
  );

-- Processar (se a função existir)
SELECT * FROM process_pending_jobs_without_approval();
```

## Verificação da Edge Function

### Verificar se Edge Function Existe

No Supabase Dashboard:
1. Vá em **Edge Functions**
2. Verifique se `generate-lyrics-for-approval` está listada
3. Verifique os logs da função para ver se está sendo chamada

### Verificar Logs da Edge Function

1. Acesse **Supabase Dashboard → Edge Functions → generate-lyrics-for-approval → Logs**
2. Verifique se há chamadas recentes
3. Verifique se há erros

## Troubleshooting

### Problema: Trigger não está chamando Edge Function

**Possíveis causas**:
1. `pg_net` não está habilitado
2. Variáveis `app.supabase_url` e `app.supabase_service_key` não estão configuradas
3. Edge Function não está deployada

**Solução**:
- O webhook também chama a função (redundância)
- Verifique se o webhook está funcionando
- Verifique logs do webhook (Railway/Vercel)

### Problema: Edge Function está sendo chamada mas não cria approval

**Possíveis causas**:
1. Erro na Edge Function
2. Dados faltando (quiz_id, etc)
3. Problema de permissão

**Solução**:
1. Verificar logs da Edge Function no Supabase Dashboard
2. Verificar se o pedido tem `quiz_id`
3. Verificar se há erros nos logs

### Problema: Jobs são criados mas approvals não

**Solução**:
1. Verificar se trigger está habilitado (query acima)
2. Verificar logs do banco de dados
3. Processar jobs pendentes manualmente usando a função auxiliar

## Fluxo Completo Corrigido

1. **Webhook recebe pagamento** → Atualiza status para `paid`
2. **Trigger `trigger_create_job_on_payment`** → Cria job automaticamente
3. **Trigger `trigger_ensure_lyrics_generation_on_job_creation`** → Tenta chamar Edge Function
4. **Webhook também chama** → Edge Function `generate-lyrics-for-approval` (redundância)
5. **Edge Function cria approval** → E inicia geração de letras
6. **Letra é gerada automaticamente** ✅

## Arquivos Criados

1. `supabase/migrations/ensure_lyrics_generation_on_job_creation.sql` - Trigger principal
2. `supabase/migrations/function_process_pending_jobs_without_approval.sql` - Função auxiliar
3. `scripts/process-pending-jobs-manually.sql` - Script de verificação e processamento manual

## Próximos Passos

1. ✅ Aplicar migration `ensure_lyrics_generation_on_job_creation.sql`
2. ✅ Verificar se trigger foi criado
3. ✅ Testar com um pedido real
4. ✅ Verificar logs da Edge Function
5. ✅ Processar jobs pendentes existentes (se houver)
