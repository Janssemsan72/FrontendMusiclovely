# ✅ Checklist de Deploy - Railway (Backend) e Vercel (Frontend)

## 📋 Status Atual

### ✅ BACKEND (Railway) - CONFIGURADO
- ✅ Dependências do Fastify adicionadas
- ✅ `tsconfig.backend.json` criado
- ✅ Scripts de build configurados
- ✅ `railway.json` configurado
- ✅ `Procfile` criado
- ✅ CORS atualizado com URL do Railway
- ✅ Build testado e funcionando

### ✅ FRONTEND (Vercel) - PRONTO
- ✅ Código otimizado
- ✅ Build configurado
- ✅ `vercel.json` configurado
- ✅ Scripts de validação

---

## 🚀 Passos para Deploy

### 1. BACKEND - Railway

#### 1.1. Preparação Local
```bash
# Instalar dependências (se ainda não instalou)
npm install

# Testar build
npm run build:backend

# Verificar se dist/index.js foi gerado
ls dist/index.js
```

#### 1.2. Deploy no Railway

1. **Criar projeto no Railway:**
   - Acesse [railway.app](https://railway.app)
   - Crie novo projeto
   - Conecte ao repositório GitHub

2. **Configurar variáveis de ambiente:**
   ```
   PORT=3000 (geralmente definido automaticamente)
   SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
   CAKTO_WEBHOOK_SECRET=seu_cakto_secret
   HOTMART_WEBHOOK_SECRET=seu_hotmart_secret
   NODE_ENV=production
   FRONTEND_URL=https://seu-dominio-vercel.vercel.app
   ```

3. **Configurar domínio público (opcional):**
   - Railway gera um domínio automático
   - Ou configure um domínio customizado
   - Copie a URL pública para usar no frontend

4. **Deploy:**
   - Railway detecta automaticamente o `railway.json`
   - Build command: `npm install && npm run build:backend`
   - Start command: `node dist/index.js`

5. **Verificar:**
   - Acesse: `https://[seu-dominio-railway]/health`
   - Deve retornar: `{"ok":true,"timestamp":"..."}`

---

### 2. FRONTEND - Vercel

#### 2.1. Preparação Local
```bash
# Testar build
npm run build

# Verificar se dist/ foi gerado
ls dist/
```

#### 2.2. Deploy na Vercel

1. **Conectar repositório:**
   - Acesse [vercel.com](https://vercel.com)
   - Importe o projeto do GitHub

2. **Configurar variáveis de ambiente:**
   ```
   VITE_SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
   VITE_BACKEND_URL=https://[seu-dominio-railway]
   ```

3. **Configurações do projeto:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Deploy:**
   - Vercel detecta automaticamente o `vercel.json`
   - Faz deploy automaticamente após push

5. **Verificar:**
   - Acesse a URL fornecida pela Vercel
   - Teste navegação e funcionalidades

---

## 🔗 Integração Frontend ↔ Backend

### URLs que Precisam ser Configuradas

**No Railway (Backend):**
- `FRONTEND_URL` - URL do frontend na Vercel (para CORS)

**No Vercel (Frontend):**
- `VITE_BACKEND_URL` - URL do backend no Railway (para chamadas de API)

### Atualizar Chamadas de API no Frontend

**Verificar se há chamadas diretas que precisam usar o backend:**

```typescript
// ❌ ANTES (se houver chamadas diretas ao Supabase Edge Functions)
const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, ...)

// ✅ DEPOIS (usar backend Railway)
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const response = await fetch(`${backendUrl}/api/checkout/create`, ...)
```

---

## ✅ Checklist Final

### Backend (Railway)
- [x] ✅ Dependências instaladas
- [x] ✅ Build configurado
- [x] ✅ `railway.json` criado
- [x] ✅ `Procfile` criado
- [x] ✅ CORS atualizado
- [ ] ⚠️ **Configurar variáveis de ambiente no Railway**
- [ ] ⚠️ **Fazer deploy no Railway**
- [ ] ⚠️ **Testar health check**
- [ ] ⚠️ **Copiar URL pública do Railway**

### Frontend (Vercel)
- [x] ✅ Código otimizado
- [x] ✅ Build configurado
- [x] ✅ `vercel.json` configurado
- [ ] ⚠️ **Configurar variáveis de ambiente no Vercel**
- [ ] ⚠️ **Adicionar `VITE_BACKEND_URL` com URL do Railway**
- [ ] ⚠️ **Fazer deploy na Vercel**
- [ ] ⚠️ **Testar aplicação**

### Integração
- [ ] ⚠️ **Atualizar `FRONTEND_URL` no Railway com URL da Vercel**
- [ ] ⚠️ **Verificar CORS funcionando**
- [ ] ⚠️ **Testar webhooks (Cakto/Hotmart)**
- [ ] ⚠️ **Testar criação de checkout**
- [ ] ⚠️ **Monitorar logs em ambos os serviços**

---

## 📝 Variáveis de Ambiente

### Railway (Backend)
```env
PORT=3000
SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CAKTO_WEBHOOK_SECRET=seu_secret_cakto
HOTMART_WEBHOOK_SECRET=seu_secret_hotmart
NODE_ENV=production
FRONTEND_URL=https://seu-dominio-vercel.vercel.app
```

### Vercel (Frontend)
```env
VITE_SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_BACKEND_URL=https://seu-dominio-railway.up.railway.app
```

---

## 🔍 Verificações Pós-Deploy

### Backend
- [ ] Health check responde: `GET /health`
- [ ] Webhooks Cakto funcionando: `POST /api/cakto/webhook`
- [ ] Webhooks Hotmart funcionando: `POST /api/hotmart/webhook`
- [ ] Checkout create funcionando: `POST /api/checkout/create`
- [ ] CORS permitindo requisições do frontend

### Frontend
- [ ] Página inicial carrega
- [ ] Quiz funciona
- [ ] Checkout funciona
- [ ] Redirecionamento para gateway de pagamento funciona
- [ ] Performance otimizada (Lighthouse)

---

## 🆘 Troubleshooting

### Backend não inicia
- Verificar se `PORT` está definido
- Verificar logs no Railway
- Testar localmente: `npm run start:backend`

### CORS bloqueando requisições
- Verificar se `FRONTEND_URL` está correto no Railway
- Verificar se URL do frontend está em `allowedOrigins`

### Frontend não encontra backend
- Verificar se `VITE_BACKEND_URL` está configurado
- Verificar se URL do backend está correta
- Testar health check do backend manualmente

---

**Status:** ✅ **PRONTO PARA DEPLOY** (após configurar variáveis de ambiente)
