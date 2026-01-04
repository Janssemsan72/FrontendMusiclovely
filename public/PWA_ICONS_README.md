# Ícones PWA - Área Administrativa

Este diretório deve conter os ícones necessários para o PWA da área administrativa.

## Ícones Necessários

1. **icon-admin-192.png** - 192x192 pixels
   - Ícone para telas de baixa resolução
   - Formato: PNG com transparência
   - Uso: Splash screen, ícone de atalho

2. **icon-admin-512.png** - 512x512 pixels
   - Ícone para telas de alta resolução
   - Formato: PNG com transparência
   - Uso: Splash screen, ícone de atalho, tela inicial

## Como Criar os Ícones

### Opção 1: Usar o Logo Existente
Se você já tem um logo, pode redimensioná-lo usando:
- Ferramentas online: https://www.iloveimg.com/resize-image
- Photoshop/GIMP
- ImageMagick: `convert logo.png -resize 192x192 icon-admin-192.png`

### Opção 2: Criar Ícones Personalizados
Use ferramentas como:
- Figma
- Canva
- Adobe Illustrator

## Especificações Técnicas

- **Formato**: PNG
- **Transparência**: Suportada (recomendado)
- **Cores**: Use a paleta de cores do tema (#C7855E)
- **Design**: Deve ser legível em tamanhos pequenos
- **Background**: Pode ser transparente ou com cor sólida

## Teste

Após criar os ícones, teste o PWA:
1. Acesse `/admin` no navegador
2. Abra as DevTools (F12)
3. Vá para a aba "Application" > "Manifest"
4. Verifique se os ícones estão sendo carregados corretamente

## Nota

Os ícones são essenciais para uma boa experiência do PWA. Sem eles, o app ainda funcionará, mas não terá ícones personalizados na tela inicial do dispositivo.

