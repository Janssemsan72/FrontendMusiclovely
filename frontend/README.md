# MusicLovely Frontend

Frontend simples e limpo da aplicação MusicLovely - Pronto para deploy na Vercel.

## Tecnologias

- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utility-first
- **React Router** - Roteamento
- **Supabase** - Backend as a Service

## Instalação

```bash
npm install
```

## Configuração

### Variáveis de Ambiente

O projeto requer variáveis de ambiente do Supabase para funcionar corretamente. Crie um arquivo `.env` na raiz do projeto `frontend/` com as seguintes variáveis:

```env
# URL do projeto Supabase
VITE_SUPABASE_URL=https://zagkvtxarndluusiluhb.supabase.co

# Chave anônima (anon/public key) do Supabase
# Esta chave é segura para uso no frontend
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Nota**: `VITE_SUPABASE_PUBLISHABLE_KEY` é um alias legado para `VITE_SUPABASE_ANON_KEY`. Se você tiver `VITE_SUPABASE_PUBLISHABLE_KEY` configurada, ela também funcionará.

### Configuração na Vercel

Para configurar as variáveis de ambiente na Vercel:

1. Acesse o dashboard do seu projeto na Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Importante**: Certifique-se de configurar essas variáveis para todos os ambientes (Production, Preview, Development).

### Comportamento sem Variáveis

Se as variáveis de ambiente não estiverem configuradas:
- O cliente Supabase será inicializado como "dummy" (cliente simulado)
- Funcionalidades que dependem do Supabase não funcionarão
- Mensagens de aviso serão exibidas apenas em desenvolvimento
- A aplicação não quebrará, mas funcionalidades do backend estarão indisponíveis

## Desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em http://localhost:8089 (porta configurada no `vite.config.ts`)

## Build

```bash
npm run build
```

## Estrutura

```
src/
├── pages/     # Páginas da aplicação
├── App.tsx    # Componente principal
└── main.tsx   # Entry point
```

## Licença

Proprietário - MusicLovely
