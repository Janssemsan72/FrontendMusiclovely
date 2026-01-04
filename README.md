# MusicLovely Frontend

Frontend da aplicação MusicLovely - Plataforma para criação de músicas personalizadas.

## Tecnologias

- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utility-first
- **shadcn/ui** - Componentes UI
- **React Router** - Roteamento
- **Supabase** - Backend as a Service
- **i18next** - Internacionalização (PT, EN, ES)

## Pré-requisitos

- Node.js 18+ e npm (ou bun)
- Conta no Supabase (para variáveis de ambiente)

## Instalação

```bash
# Instalar dependências
npm install

# Ou com bun
bun install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_STRIPE_PUBLISHABLE_KEY=sua_chave_stripe
```

## Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# O servidor estará disponível em http://localhost:8089
```

## Build

```bash
# Build para produção
npm run build

# Preview do build de produção
npm run preview
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes React reutilizáveis
├── pages/         # Páginas da aplicação
├── hooks/         # Custom hooks
├── lib/           # Utilitários e helpers
├── i18n/          # Traduções e configuração i18n
├── routes/         # Configuração de rotas
├── services/      # Serviços externos
├── types/          # Definições TypeScript
└── utils/          # Funções utilitárias

public/
├── images/         # Imagens estáticas
├── video/          # Vídeos
├── audio/          # Áudios
└── testimonials/   # Imagens de depoimentos
```

## Deploy

O projeto está configurado para deploy no Vercel. O arquivo `vercel.json` contém as configurações necessárias.

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa o linter

## Licença

Proprietário - MusicLovely

