# Avatares dos Testimonials

## Estrutura de Arquivos Necessária

Para que os avatares funcionem corretamente baseados no gênero, você precisa ter os seguintes arquivos na pasta `public/testimonials/`:

### Avatares Femininos:
- `avatar-female-1.webp` - Para testimonials femininos (índice 0, 3, 6...)
- `avatar-female-2.webp` - Para testimonials femininos (índice 1, 4, 7...)
- `avatar-female-3.webp` - Para testimonials femininos (índice 2, 5, 8...)

### Avatares Masculinos:
- `avatar-male-1.webp` - Para testimonials masculinos (índice 0, 3, 6...)
- `avatar-male-2.webp` - Para testimonials masculinos (índice 1, 4, 7...)
- `avatar-male-3.webp` - Para testimonials masculinos (índice 2, 5, 8...)

## Como o Sistema Funciona

1. **Identificação de Gênero**: O sistema identifica o gênero baseado em:
   - **Role** (papel): Noiva, Filha, Mãe, Esposa = Feminino | Empresário, Pai, Esposo, Filho = Masculino
   - **Nome**: Primeiro nome é comparado com listas de nomes comuns
   - **Fallback**: Se não conseguir identificar, alterna por índice

2. **Seleção de Avatar**: 
   - Se o testimonial já tem `avatar_url` no banco de dados, usa esse
   - Caso contrário, seleciona um avatar apropriado baseado no gênero e índice

## Formatos Recomendados

- **Formato**: WebP (melhor compressão)
- **Tamanho**: 128x128px ou 256x256px (será redimensionado pelo CSS)
- **Qualidade**: Otimizado para web (80-90% qualidade)

## Exemplos de Uso

- **Ana Silva** (Noiva) → `avatar-female-1.webp`
- **Carlos Mendes** (Empresário) → `avatar-male-1.webp`
- **Mariana Costa** (Filha) → `avatar-female-2.webp`

## Nota

Os arquivos antigos (`avatar-1.webp`, `avatar-2.webp`, `avatar-3.webp`) ainda são mantidos para compatibilidade, mas o sistema agora prioriza os avatares por gênero.
