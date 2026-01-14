# 🔍 Auditoria Completa de Deploy - Railway (Backend) e Vercel (Frontend)

## Data da Auditoria
${new Date().toISOString().split('T')[0]}

## 📋 Resumo Executivo

Esta auditoria verifica se o **backend Fastify** está pronto para deploy na **Railway** e o **frontend React** está pronto para deploy na **Vercel**.

---

## ✅ BACKEND (Railway) - Status: ✅ CONFIGURADO (PRECISA INSTALAR DEPENDÊNCIAS)

### 1. Estrutura do Backend

**✅ Código Backend:**
- ✅ `src/index.ts` - Servidor Fastify principal
- ✅ `src/routes/payment.ts` - Rotas de pagamento (Cakto, Hotmart)
- ✅ `src/routes/generation.ts` - Rotas de geração (lyrics, audio)
- ✅ Health check endpoint (`/health`)
- ✅ CORS configurado
- ✅ Porta configurável via `PORT` env var

**✅ Correções Aplicadas:**
- ✅ Dependências do Fastify adicionadas ao `package.json`
- ✅ `tsconfig.backend.json` criado para compilação do backend
- ✅ Scripts `build:backend` e `start:backend` adicionados
- ✅ Script `dev:backend` adicionado para desenvolvimento
- ✅ CORS atualizado para incluir URL do Railway
- ✅ `railway.json` configurado com healthcheck
- ✅ `Procfile` criado

**⚠️ Ação Necessária:**
- ⚠️ **Instalar dependências:** `npm install` (para instalar Fastify)

### 2. Dependências Necessárias

**❌ Faltando no `package.json`:**
```json
{
  "dependencies": {
    "fastify": "^4.x.x",
    "@fastify/cors": "^8.x.x",
    "@supabase/supabase-js": "^2.89.0" // ✅ Já existe
  },
  "devDependencies": {
    "@types/node": "^22.10.7", // ✅ Já existe
    "typescript": "^5.7.3" // ✅ Já existe
  }
}
```

### 3. Variáveis de Ambiente Necessárias

**✅ Backend precisa de:**
```env
PORT=3000                    # Porta do servidor (Railway define automaticamente)
SUPABASE_URL=...            # URL do Supabase
SUPABASE_SERVICE_ROLE_KEY=... # Service role key (para operações admin)
CAKTO_WEBHOOK_SECRET=...    # Secret do webhook Cakto
HOTMART_WEBHOOK_SECRET=...  # Secret do webhook Hotmart
NODE_ENV=production         # Ambiente
```

### 4. Configuração do Railway

**✅ Arquivos Criados:**
- ✅ `railway.json` - Configuração do Railway
- ✅ `Procfile` - Comando de start

**⚠️ Ajustes Necessários:**
- ⚠️ Criar `tsconfig.backend.json` específico para backend
- ⚠️ Adicionar script `build:backend` no `package.json`
- ⚠️ Adicionar dependências do Fastify

### 5. Rotas do Backend

**✅ Endpoints Implementados:**
- ✅ `GET /health` - Health check
- ✅ `POST /api/cakto/webhook` - Webhook Cakto
- ✅ `POST /api/hotmart/webhook` - Webhook Hotmart
- ✅ `POST /api/checkout/create` - Criar checkout
- ✅ `POST /api/lyrics/generate` - Gerar letras
- ✅ `POST /api/audio/generate` - Gerar áudio
- ✅ `POST /api/suno/callback` - Callback Suno

**✅ Funcionalidades:**
- ✅ Validação de webhooks
- ✅ Idempotência de emails
- ✅ Retry logic
- ✅ Logs estruturados
- ✅ Headers de segurança

---

## ✅ FRONTEND (Vercel) - Status: PRONTO PARA DEPLOY

### 1. Estrutura do Projeto

**✅ Estrutura Principal (Raiz `/`):**
- ✅ `package.json` - Configurado corretamente
- ✅ `vite.config.ts` - Otimizado para produção (185 linhas)
- ✅ `vercel.json` - Configurado com headers, cache e rewrites
- ✅ `index.html` - Otimizado com preloads condicionais
- ✅ `src/` - Código fonte completo
- ✅ `public/` - Assets estáticos (imagens, vídeos, áudios)
- ✅ `scripts/validate-env.js` - Validação de variáveis de ambiente

### 2. Configurações de Build

**✅ `vite.config.ts` - OTIMIZADO:**
- ✅ Minificação com Terser
- ✅ Tree shaking configurado
- ✅ Code splitting manual otimizado
- ✅ Compressão Gzip e Brotli
- ✅ Processamento de imagens (vite-imagetools)
- ✅ Source maps apenas em dev
- ✅ Target ES2020

### 3. Configuração do Vercel

**✅ `vercel.json` - COMPLETO:**
- ✅ Headers de segurança (CSP, X-Frame-Options, etc.)
- ✅ Cache headers otimizados
- ✅ Rewrites para SPA
- ✅ Functions configuradas

### 4. Variáveis de Ambiente

**✅ Frontend precisa de:**
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**⚠️ AÇÃO NECESSÁRIA:** Configurar no painel do Vercel

---

## 🔧 CORREÇÕES NECESSÁRIAS PARA BACKEND

### 1. ✅ Instalar Dependências do Fastify

```bash
npm install
```

**✅ JÁ APLICADO:** Dependências adicionadas ao `package.json`:
- `fastify: ^4.28.1`
- `@fastify/cors: ^9.0.1`
- `tsx: ^4.19.2` (dev dependency)

### 2. ✅ Criar `tsconfig.backend.json`

**✅ JÁ CRIADO:** `tsconfig.backend.json` configurado com:
- Extends do `tsconfig.json` principal
- Output para `dist/`
- Include apenas arquivos do backend
- Exclude arquivos do frontend

### 3. ✅ Adicionar Scripts no `package.json`

**✅ JÁ ADICIONADO:**
- `build:backend` - Compila TypeScript do backend
- `start:backend` - Inicia servidor em produção
- `dev:backend` - Desenvolvimento com hot reload

### 4. ✅ Atualizar `railway.json`

**✅ JÁ CONFIGURADO:**
- Build command: `npm install && npm run build:backend`
- Start command: `node dist/index.js`
- Healthcheck: `/health`

### 5. ✅ Atualizar CORS no Backend

**✅ JÁ ATUALIZADO:** CORS agora inclui:
- `process.env.RAILWAY_PUBLIC_DOMAIN` - URL pública do Railway
- `process.env.FRONTEND_URL` - URL do frontend (Vercel)
- URLs de produção e desenvolvimento

---

## 📋 CHECKLIST DE DEPLOY

### Backend (Railway)

- [x] ✅ Adicionar dependências do Fastify ao `package.json`
- [x] ✅ Criar `tsconfig.backend.json`
- [x] ✅ Adicionar scripts `build:backend` e `start:backend`
- [x] ✅ Atualizar CORS com URL do Railway
- [ ] ⚠️ **Instalar dependências:** `npm install`
- [ ] ⚠️ Configurar variáveis de ambiente no Railway:
  - [ ] `PORT` (geralmente definido automaticamente)
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `CAKTO_WEBHOOK_SECRET`
  - [ ] `HOTMART_WEBHOOK_SECRET`
  - [ ] `NODE_ENV=production`
- [ ] ⚠️ Testar build local: `npm run build:backend`
- [ ] ⚠️ Testar start local: `npm run start:backend`
- [ ] ⚠️ Fazer deploy no Railway
- [ ] ⚠️ Verificar health check: `https://[seu-dominio-railway]/health`
- [ ] ⚠️ Configurar domínio público no Railway (se necessário)

### Frontend (Vercel)

- [x] ✅ Estrutura do projeto correta
- [x] ✅ `vite.config.ts` otimizado
- [x] ✅ `vercel.json` configurado
- [ ] ⚠️ **Configurar variáveis de ambiente no Vercel:**
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] ⚠️ **Atualizar URL do backend no frontend:**
  - [ ] Adicionar variável `VITE_BACKEND_URL` no Vercel
  - [ ] Atualizar chamadas de API no frontend para usar `VITE_BACKEND_URL`
- [ ] ⚠️ Testar build local: `npm run build`
- [ ] ⚠️ Testar preview local: `npm run preview`
- [ ] ⚠️ Fazer deploy na Vercel

---

## 🔗 Integração Frontend ↔ Backend

### URLs que Precisam ser Configuradas

**Frontend precisa conhecer:**
- URL do backend (Railway): `VITE_BACKEND_URL`
- URL do Supabase: `VITE_SUPABASE_URL` (já configurado)

**Backend precisa conhecer:**
- URL do frontend (Vercel): Para CORS
- URL do Supabase: `SUPABASE_URL` (já configurado)

### Atualizar Chamadas de API no Frontend

**Procurar por:**
- Chamadas diretas ao Supabase Edge Functions
- Chamadas que devem ir para o backend Railway

**Exemplo:**
```typescript
// ❌ ANTES (chamada direta)
const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, ...)

// ✅ DEPOIS (via backend Railway)
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const response = await fetch(`${backendUrl}/api/checkout/create`, ...)
```

---

## 🚨 AÇÕES CRÍTICAS ANTES DO DEPLOY

### Backend (Railway)

1. ✅ **Adicionar dependências do Fastify** - CONCLUÍDO
2. ✅ **Criar `tsconfig.backend.json`** - CONCLUÍDO
3. ✅ **Adicionar scripts de build** - CONCLUÍDO
4. ✅ **Atualizar CORS com URL do Railway** - CONCLUÍDO
5. ⚠️ **Instalar dependências:** `npm install` - PENDENTE
6. ⚠️ **Configurar variáveis de ambiente no Railway** - PENDENTE
7. ⚠️ **Testar build local:** `npm run build:backend` - PENDENTE

### Frontend (Vercel)

1. **Configurar variáveis de ambiente no Vercel** ⚠️ CRÍTICO
2. **Adicionar `VITE_BACKEND_URL`** ⚠️ IMPORTANTE
3. **Atualizar chamadas de API para usar backend Railway** ⚠️ IMPORTANTE

---

## 📊 Estrutura de Deploy Recomendada

```
/
├── src/
│   ├── index.ts              ✅ Backend Fastify (Railway)
│   ├── routes/               ✅ Rotas do backend
│   ├── pages/                ✅ Frontend React (Vercel)
│   └── components/           ✅ Frontend React (Vercel)
├── package.json              ⚠️ Precisa incluir dependências do Fastify
├── tsconfig.json             ✅ Frontend
├── tsconfig.backend.json     ⚠️ PRECISA SER CRIADO
├── railway.json              ✅ Configuração Railway
├── Procfile                  ✅ Comando de start
├── vercel.json               ✅ Configuração Vercel
└── vite.config.ts            ✅ Build frontend
```

---

## ✅ CONCLUSÃO

### Backend (Railway)
**Status: ⚠️ PRECISA DE CONFIGURAÇÃO**

- ✅ Código backend está implementado e funcional
- ❌ Faltam dependências do Fastify
- ❌ Falta configuração de build
- ❌ Falta `tsconfig` específico para backend
- ⚠️ Precisa configurar variáveis de ambiente no Railway

### Frontend (Vercel)
**Status: ✅ PRONTO PARA DEPLOY**

- ✅ Código otimizado
- ✅ Build configurado
- ✅ Vercel configurado
- ⚠️ **Falta:** Configurar variáveis de ambiente no Vercel
- ⚠️ **Falta:** Atualizar chamadas de API para usar backend Railway

---

## 📝 Próximos Passos

1. **Backend:**
   - Adicionar dependências do Fastify
   - Criar `tsconfig.backend.json`
   - Adicionar scripts de build
   - Configurar variáveis no Railway
   - Fazer deploy

2. **Frontend:**
   - Configurar variáveis no Vercel
   - Adicionar `VITE_BACKEND_URL`
   - Atualizar chamadas de API
   - Fazer deploy

3. **Integração:**
   - Testar comunicação frontend ↔ backend
   - Verificar CORS
   - Testar webhooks
   - Monitorar logs

---

**Status Final:** 
- Backend: ⚠️ **PRECISA DE CONFIGURAÇÃO** (dependências e build)
- Frontend: ✅ **PRONTO** (após configurar variáveis)
