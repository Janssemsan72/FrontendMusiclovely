# 📁 Estrutura do Projeto MusicLovely

Este projeto está organizado em duas pastas principais para separação entre frontend e backend, permitindo deploy independente em plataformas diferentes.

## 🗂️ Estrutura de Pastas

```
Musiclovelyoficial-main 67 .com/
├── frontend/          # Código do frontend (React/Vite) → Deploy na Vercel
├── backend/           # Código do backend (Fastify) → Deploy na Railway
└── README-ESTRUTURA.md # Este arquivo
```

## 🎯 Frontend (`frontend/`)

**Localização:** `frontend/`  
**Deploy:** Vercel  
**Repositório GitHub:** Separado (apenas código do frontend)

### O que contém:
- Aplicação React com Vite
- Componentes, páginas, hooks
- Configurações do Vite, Tailwind, TypeScript
- Arquivos estáticos (public/)
- Configuração do Vercel (vercel.json)

### Para subir para repositório separado:
```bash
cd frontend
git init
git remote add origin <url-do-repositorio-frontend>
git add .
git commit -m "Initial commit - Frontend"
git push -u origin main
```

## ⚙️ Backend (`backend/`)

**Localização:** `backend/`  
**Deploy:** Railway  
**Repositório GitHub:** Separado (apenas código do backend)

### O que contém:
- API Fastify com TypeScript
- Rotas de pagamento e webhooks
- Rotas de geração (proxy para Edge Functions)
- Utilitários de segurança e tratamento de erros
- Configurações do TypeScript e Node.js

### Para subir para repositório separado:
```bash
cd backend
git init
git remote add origin <url-do-repositorio-backend>
git add .
git commit -m "Initial commit - Backend"
git push -u origin main
```

## 🔗 Integração Frontend ↔️ Backend

### Variáveis de Ambiente do Frontend

O frontend precisa conhecer a URL do backend. Configure no Vercel:

```env
VITE_BACKEND_URL=https://seu-backend.railway.app
```

### Variáveis de Ambiente do Backend

O backend precisa das credenciais do Supabase e outras configurações. Configure no Railway:

```env
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
CAKTO_WEBHOOK_SECRET=seu_secret_webhook
PORT=3000
NODE_ENV=production
```

### CORS

O backend está configurado para aceitar requisições do frontend. As origens permitidas estão em `backend/src/utils/security.ts`.

## 📦 Dependências

Cada pasta tem seu próprio `package.json` e deve ser instalado separadamente:

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

## 🚀 Deploy

### Frontend (Vercel)
1. Conecte o repositório do frontend ao Vercel
2. Configure as variáveis de ambiente
3. O Vercel detectará automaticamente o Vite e fará o build

### Backend (Railway)
1. Conecte o repositório do backend ao Railway
2. Configure as variáveis de ambiente
3. O Railway executará `npm run build` e `npm start`

## 🔄 Fluxo de Trabalho

### Desenvolvimento Local

1. **Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Roda em http://localhost:5173 (ou porta configurada)
   ```

2. **Backend:**
   ```bash
   cd backend
   npm run dev
   # Roda em http://localhost:3000
   ```

### Atualizações

- **Frontend:** Faça alterações em `frontend/`, commit e push para o repositório do frontend
- **Backend:** Faça alterações em `backend/`, commit e push para o repositório do backend

## 📝 Notas Importantes

1. **Separação de Código:** 
   - O código do frontend NÃO deve estar no repositório do backend
   - O código do backend NÃO deve estar no repositório do frontend

2. **Variáveis de Ambiente:**
   - Cada projeto tem suas próprias variáveis de ambiente
   - Não compartilhe secrets entre projetos

3. **Dependências:**
   - Cada projeto gerencia suas próprias dependências
   - Não há dependências compartilhadas entre frontend e backend

4. **Build:**
   - Frontend: Build é feito pelo Vite (`npm run build`)
   - Backend: Build é feito pelo TypeScript (`npm run build`)

## 🆘 Troubleshooting

### Frontend não consegue conectar ao backend
- Verifique se a variável `VITE_BACKEND_URL` está configurada corretamente
- Verifique se o CORS no backend permite a origem do frontend
- Verifique se o backend está rodando e acessível

### Backend retorna erro de CORS
- Verifique se a origem do frontend está na lista `ALLOWED_ORIGINS` em `backend/src/utils/security.ts`
- Verifique se o header `Origin` está sendo enviado corretamente

### Erro ao fazer build do backend
- Verifique se todas as dependências estão instaladas (`npm install`)
- Verifique se o TypeScript está configurado corretamente
- Verifique se todas as variáveis de ambiente estão configuradas

## 📚 Documentação Adicional

- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)
