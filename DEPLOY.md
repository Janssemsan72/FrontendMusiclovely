# 🚀 Guia de Deploy - Frontend MusicLovely

Este guia explica como fazer o deploy do frontend no repositório GitHub: https://github.com/Janssemsan72/Frontendmusiclovely

## 📋 Pré-requisitos

1. Git instalado e configurado
2. Acesso ao repositório: https://github.com/Janssemsan72/Frontendmusiclovely
3. Node.js 18+ instalado

## 🔧 Passos para Deploy

### 1. Preparar o Repositório Local

```bash
# Verificar o status atual
git status

# Adicionar todas as alterações
git add .

# Fazer commit das alterações
git commit -m "feat: preparar frontend para produção"
```

### 2. Configurar o Remote (se necessário)

```bash
# Verificar remotes existentes
git remote -v

# Se não existir o remote 'origin', adicionar:
git remote add origin https://github.com/Janssemsan72/Frontendmusiclovely.git

# Ou atualizar o remote existente:
git remote set-url origin https://github.com/Janssemsan72/Frontendmusiclovely.git
```

### 3. Fazer Push para o GitHub

```bash
# Fazer push para a branch main (ou master)
git push -u origin main

# Se a branch for diferente, substitua 'main' pelo nome da sua branch
```

### 4. Verificar o Deploy

Após o push, verifique:
- ✅ Todos os arquivos foram enviados corretamente
- ✅ Não há arquivos sensíveis (`.env`, `node_modules`, etc.)
- ✅ O build funciona corretamente

## ⚠️ Checklist Antes do Deploy

Antes de fazer o push, certifique-se de:

- [ ] ✅ Build de produção funciona: `npm run build`
- [ ] ✅ TypeScript não tem erros: `npm run typecheck`
- [ ] ✅ Não há arquivos `.env` no commit
- [ ] ✅ Não há arquivos de backend (`src/index.ts`, `src/routes/`)
- [ ] ✅ `node_modules/` está no `.gitignore`
- [ ] ✅ `dist/` está no `.gitignore`
- [ ] ✅ README.md está atualizado

## 🔒 Segurança

**NUNCA commite:**
- ❌ Arquivos `.env` ou `.env.local`
- ❌ Chaves de API ou secrets
- ❌ Arquivos de backend
- ❌ `node_modules/`
- ❌ Arquivos de build (`dist/`)

## 📦 Estrutura do Repositório

O repositório deve conter apenas:
- ✅ Código fonte (`src/`)
- ✅ Arquivos públicos (`public/`)
- ✅ Arquivos de configuração (`package.json`, `vite.config.ts`, etc.)
- ✅ README.md
- ✅ `.gitignore`

## 🚀 Deploy Automático (Vercel)

Se o repositório estiver conectado ao Vercel:

1. O deploy será automático após cada push
2. Configure as variáveis de ambiente no dashboard do Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (opcional)

## 🐛 Troubleshooting

### Erro: "fatal: remote origin already exists"
```bash
# Remover o remote existente e adicionar novamente
git remote remove origin
git remote add origin https://github.com/Janssemsan72/Frontendmusiclovely.git
```

### Erro: "failed to push some refs"
```bash
# Fazer pull primeiro e depois push
git pull origin main --rebase
git push origin main
```

### Build falha no Vercel
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique se o `package.json` tem o script `build` correto
- Verifique os logs de build no dashboard do Vercel

## 📝 Comandos Úteis

```bash
# Verificar o que será commitado
git status

# Ver diferenças
git diff

# Ver histórico de commits
git log --oneline

# Desfazer último commit (mantendo alterações)
git reset --soft HEAD~1

# Verificar arquivos ignorados
git check-ignore -v <arquivo>
```
