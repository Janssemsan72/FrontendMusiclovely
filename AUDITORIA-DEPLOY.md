# 🔍 Auditoria de Deploy - Frontend MusicLovely

## 📋 Resumo Executivo

O frontend funciona perfeitamente em localhost, mas apresenta problemas no deploy (Vercel/GitHub). Esta auditoria identifica as diferenças críticas entre o ambiente local e o deploy.

## 🔴 Problemas Identificados

### 1. **Configuração do Vite Incompleta no Repositório**

**Problema:** O `vite.config.ts` no repositório GitHub pode estar desatualizado ou simplificado comparado ao local.

**Evidência:**
- Local (raiz): `vite.config.ts` tem 95 linhas com configurações completas de build
- Frontend: `vite.config.ts` tem apenas 18 linhas, muito simplificado
- O repositório GitHub provavelmente está usando uma versão simplificada

**Impacto:**
- Build pode falhar ou gerar assets incorretos
- Code splitting pode não funcionar corretamente
- Assets (imagens, fonts) podem não ser processados corretamente
- Minificação pode estar desabilitada ou mal configurada

### 2. **Estrutura de Diretórios Duplicada**

**Problema:** Existem duas estruturas de projeto:
- `/` (raiz) - Estrutura principal
- `/frontend/` - Estrutura alternativa/duplicada

**Impacto:**
- Confusão sobre qual estrutura está sendo usada no deploy
- Possível build do diretório errado
- Configurações podem estar apontando para o diretório incorreto

### 3. **Configuração do Vercel**

**Problema:** O `vercel.json` pode não estar apontando para o diretório correto ou pode ter configurações incorretas.

**Verificação necessária:**
- `buildCommand` está correto?
- `outputDirectory` está correto?
- `installCommand` está correto?

### 4. **Variáveis de Ambiente**

**Problema:** Variáveis de ambiente podem não estar configuradas no Vercel.

**Verificação necessária:**
- `VITE_SUPABASE_URL` está configurada?
- `VITE_SUPABASE_ANON_KEY` está configurada?
- `VITE_STRIPE_PUBLISHABLE_KEY` está configurada?

### 5. **Diferenças no index.html**

**Problema:** O `index.html` da raiz tem otimizações (preload) que podem estar faltando no repositório.

**Evidência:**
- Local (raiz): Tem preload de CSS e comentários de otimização
- Frontend: Versão mais simples sem otimizações

## ✅ Soluções Recomendadas

### Solução 1: Sincronizar vite.config.ts

O `vite.config.ts` da raiz deve ser usado no repositório. Ele contém:
- ✅ Configurações completas de build
- ✅ Code splitting otimizado
- ✅ Processamento correto de assets
- ✅ Minificação configurada
- ✅ Source maps apenas em dev
- ✅ Configurações de base URL

### Solução 2: Definir Estrutura Única

**Recomendação:** Usar a estrutura da raiz (`/`) como principal e remover ou documentar o diretório `/frontend/`.

### Solução 3: Verificar Configuração do Vercel

Garantir que o `vercel.json` está configurado corretamente:
- `buildCommand`: `npm run build` (na raiz)
- `outputDirectory`: `dist`
- `installCommand`: `npm install` (na raiz)

### Solução 4: Verificar Variáveis de Ambiente

Garantir que todas as variáveis de ambiente estão configuradas no painel do Vercel.

### Solução 5: Sincronizar index.html

Usar a versão otimizada do `index.html` da raiz.

## 🔧 Plano de Ação

1. **Verificar qual estrutura está no repositório GitHub**
2. **Sincronizar `vite.config.ts` completo**
3. **Sincronizar `index.html` otimizado**
4. **Verificar e corrigir `vercel.json`**
5. **Verificar variáveis de ambiente no Vercel**
6. **Testar build local antes de fazer deploy**
7. **Fazer deploy e verificar logs**

## 📝 Checklist de Verificação

- [ ] `vite.config.ts` está completo e sincronizado
- [ ] `index.html` está otimizado
- [ ] `vercel.json` está configurado corretamente
- [ ] Variáveis de ambiente estão configuradas no Vercel
- [ ] Build local funciona (`npm run build`)
- [ ] Preview local funciona (`npm run preview`)
- [ ] Estrutura de diretórios está clara
- [ ] `.gitignore` está correto
- [ ] `package.json` está sincronizado

## 🚨 Problemas Críticos a Resolver

1. **PRIORIDADE ALTA:** Sincronizar `vite.config.ts` completo
2. **PRIORIDADE ALTA:** Verificar estrutura de diretórios no repositório
3. **PRIORIDADE MÉDIA:** Verificar configuração do Vercel
4. **PRIORIDADE MÉDIA:** Verificar variáveis de ambiente
5. **PRIORIDADE BAIXA:** Otimizar `index.html`

## 📊 Comparação de Arquivos

### vite.config.ts

**Raiz (Completo - 95 linhas):**
- ✅ Configurações de base URL
- ✅ Code splitting manual otimizado
- ✅ Processamento de assets
- ✅ Minificação configurada
- ✅ Source maps condicionais
- ✅ Configurações de servidor

**Frontend (Simplificado - 18 linhas):**
- ❌ Apenas configurações básicas
- ❌ Sem otimizações de build
- ❌ Sem processamento de assets

### index.html

**Raiz:**
- ✅ Preload de CSS
- ✅ Comentários de otimização
- ✅ Estrutura completa

**Frontend:**
- ⚠️ Versão básica sem otimizações

## 🔍 Próximos Passos

1. Verificar o repositório GitHub para ver qual estrutura está sendo usada
2. Sincronizar arquivos críticos
3. Testar build local
4. Fazer deploy e monitorar logs
5. Verificar funcionamento em produção
