# 🔧 Como Configurar as Variáveis de Ambiente

## Problema Identificado

O Supabase não está configurado porque as variáveis de ambiente não estão definidas. Isso faz com que:
- O cliente Supabase seja inicializado como "dummy" (simulado)
- Os depoimentos não sejam buscados do banco de dados
- A aplicação use dados mockados (que já foram implementados)

## ✅ Solução

### Opção 1: Configurar .env (Recomendado para desenvolvimento)

1. **Crie o arquivo `.env` na raiz do projeto** (mesmo nível que `frontend/` e `src/`)

2. **Adicione as seguintes variáveis:**

```env
VITE_SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

3. **Onde obter a chave anon:**
   - Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
   - Vá em **Settings** → **API**
   - Copie a chave **anon public** (não a service_role!)

4. **Reinicie o servidor de desenvolvimento:**
   ```bash
   # Pare o servidor (Ctrl+C)
   # Inicie novamente
   npm run dev
   ```

### Opção 2: Usar Dados Mockados (Já implementado)

Se você não quiser configurar o Supabase agora, os depoimentos mockados já estão funcionando. A seção deve aparecer com:
- 3 depoimentos de exemplo
- Estatísticas (500+, 5.0, 48h)

## 📝 Verificação

Após configurar o `.env`, verifique no console do navegador:

**Antes (sem .env):**
```
⚠️ ATENÇÃO: Variáveis de ambiente não configuradas!
⚠️ Supabase não configurado. Usando depoimentos mockados para desenvolvimento.
```

**Depois (com .env):**
```
✅ Depoimentos ativos encontrados: 3
```

## 🔒 Segurança

- ✅ A chave `anon` é segura para uso no frontend
- ❌ NUNCA use a chave `service_role` no frontend
- ✅ O arquivo `.env` está no `.gitignore` (não será commitado)

## 🚀 Para Produção (Vercel)

Configure as variáveis de ambiente na Vercel:
1. Acesse o dashboard do projeto
2. Vá em **Settings** → **Environment Variables**
3. Adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Configure para todos os ambientes (Production, Preview, Development)

## ✅ Status Atual

- ✅ Dados mockados implementados (funciona sem Supabase)
- ✅ Componente sempre renderiza a seção
- ⚠️ Falta configurar variáveis de ambiente para usar dados reais
