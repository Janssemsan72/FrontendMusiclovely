# Guia Rápido: Aplicar Migration para Geração Automática de Letras

## ✅ Fluxo Completo (Já Implementado)

1. **Webhook recebe pagamento** → Atualiza status para `paid`
2. **Trigger do banco** → Cria job automaticamente
3. **Webhook chama Edge Function** → `generate-lyrics-for-approval` (já implementado nas linhas 622-648 de `src/routes/payment.ts`)

## 🚀 Como Aplicar a Migration (Se Houver Timeout)

Se a migration completa der timeout, aplique em **2 partes**:

### Parte 1: Criar Função

1. Acesse **Supabase Dashboard → SQL Editor**
2. Execute o arquivo: `supabase/migrations/create_job_on_payment_trigger_part1.sql`
3. Aguarde confirmação de sucesso

### Parte 2: Criar Trigger

1. Ainda no **SQL Editor**
2. Execute o arquivo: `supabase/migrations/create_job_on_payment_trigger_part2.sql`
3. Aguarde confirmação de sucesso

## ✅ Verificar se Funcionou

Execute esta query para verificar:

```sql
-- Verificar se trigger foi criado
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
WHERE c.relname = 'orders'
  AND t.tgname = 'trigger_create_job_on_payment';
```

**Resultado esperado**: Deve retornar 1 linha com status "HABILITADO ✅"

## 🧪 Testar

Após aplicar a migration, teste com um pedido real:

1. Um pedido é pago via webhook
2. O trigger cria o job automaticamente
3. O webhook chama a Edge Function `generate-lyrics-for-approval`
4. A letra é gerada automaticamente

## 📝 Notas Importantes

- ✅ O webhook **já está configurado** para chamar a Edge Function (linhas 622-648 de `src/routes/payment.ts`)
- ✅ Funciona para **Cakto** e **Hotmart** (ambos têm o mesmo código)
- ✅ O trigger cria o job **automaticamente** quando status muda para `paid`
- ✅ Verificação de idempotência previne jobs duplicados

## 🔍 Troubleshooting

### Problema: Timeout na migration
**Solução**: Aplique em partes (Parte 1 e Parte 2 separadamente)

### Problema: Trigger não está criado
**Solução**: Execute a Parte 2 novamente

### Problema: Job é criado mas letra não é gerada
**Solução**: Verifique se a Edge Function `generate-lyrics-for-approval` está deployada e funcionando

### Problema: Múltiplos jobs sendo criados
**Solução**: A verificação de idempotência deve prevenir isso. Se acontecer, verifique os logs do banco.
