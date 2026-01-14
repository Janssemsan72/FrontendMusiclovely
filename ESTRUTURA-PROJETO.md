# Estrutura do Projeto MusicLovely

## Estrutura Principal

O projeto MusicLovely utiliza uma estrutura de **monorepo** com o código fonte principal na **raiz do projeto**.

### Diretório Principal: `/src/`

A estrutura principal do frontend está localizada em `/src/` na raiz do projeto:

```
/
├── src/                    # ✅ Código fonte principal (USAR ESTA)
│   ├── components/         # Componentes React reutilizáveis
│   ├── pages/             # Páginas da aplicação
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilitários e helpers
│   ├── i18n/              # Traduções e configuração i18n
│   ├── routes/            # Configuração de rotas
│   ├── services/          # Serviços externos
│   ├── types/             # Definições TypeScript
│   └── utils/             # Funções utilitárias
├── public/                 # Assets estáticos (imagens, vídeos, áudios)
├── vite.config.ts         # ✅ Configuração principal do Vite (185 linhas, otimizada)
├── vercel.json            # ✅ Configuração principal do Vercel (completa)
├── index.html             # ✅ HTML principal (otimizado)
├── package.json           # ✅ Dependências principais
└── tsconfig.json          # ✅ Configuração TypeScript principal
```

## Estruturas que NÃO devem existir

### ❌ `frontend/frontend/` - REMOVIDO

Esta estrutura era uma duplicação desnecessária que foi removida. **NÃO recrie esta estrutura.**

### ⚠️ `frontend/src/` - Não usar

O diretório `frontend/` existe mas contém apenas configurações auxiliares. **NÃO use `frontend/src/` como código fonte principal.**

## Por que não deve haver duplicações?

1. **Confusão**: Múltiplas estruturas causam confusão sobre qual é a fonte da verdade
2. **Sincronização**: Arquivos duplicados podem ficar desatualizados
3. **Build**: O build pode usar a estrutura errada
4. **Manutenção**: Mais difícil manter código duplicado
5. **Deploy**: Pode causar problemas no deploy (Vercel, Railway, etc.)

## Configurações Principais

### Build e Deploy

- **Vite Config**: `/vite.config.ts` (raiz) - Versão otimizada com 185 linhas
- **Vercel Config**: `/vercel.json` (raiz) - Versão completa com todos os headers
- **TypeScript**: `/tsconfig.json` (raiz) - Configuração principal

### Scripts NPM

Execute os scripts da **raiz do projeto**:

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Verificação

Para verificar se a estrutura está correta:

1. ✅ O código fonte principal está em `/src/`
2. ✅ Não existe `frontend/frontend/`
3. ✅ O `vite.config.ts` da raiz tem ~185 linhas (versão otimizada)
- O `vercel.json` da raiz tem ~155 linhas (versão completa)

## Prevenção de Duplicações

O arquivo `.gitignore` contém regras para prevenir futuras duplicações:

```
# Prevenir duplicação de estruturas (frontend/frontend/)
frontend/frontend/
*/frontend/frontend/
**/frontend/frontend/
```

## Referências

- Documentação de deploy: `AUDITORIA-DEPLOY-COMPLETA.md`
- Correções de deploy: `CORRECAO-DEPLOY.md`
- Atualizações: `ATUALIZACOES-REALIZADAS.md`

## Checklist para Novos Desenvolvedores

- [ ] Usar apenas `/src/` como código fonte
- [ ] Não criar estruturas duplicadas
- [ ] Verificar `.gitignore` antes de commitar
- [ ] Usar configurações da raiz (`vite.config.ts`, `vercel.json`)
- [ ] Executar scripts da raiz do projeto
