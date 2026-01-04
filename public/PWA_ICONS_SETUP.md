# Ícones PWA para Área Admin

## Ícones Necessários

Para o PWA funcionar completamente, você precisa criar os seguintes ícones:

### 1. Ícones Padrão
- `icon-admin-192.png` - 192x192 pixels, PNG
- `icon-admin-512.png` - 512x512 pixels, PNG

### 2. Ícones Maskable (Android)
- `maskable-admin-192.png` - 192x192 pixels, PNG, com padding seguro (mínimo 10% de cada lado)
- `maskable-admin-512.png` - 512x512 pixels, PNG, com padding seguro (mínimo 10% de cada lado)

### 3. Apple Touch Icon (iOS)
- `apple-touch-icon-admin.png` - 180x180 pixels mínimo (recomendado 1024x1024), PNG

## Especificações

### Maskable Icons
Os ícones maskable devem ter conteúdo importante dentro de uma "safe zone" que representa 80% do centro da imagem. Isso garante que o ícone não seja cortado quando o Android aplica máscaras diferentes.

### Design Guidelines
- Use cores do tema: `#C7855E` (primary)
- Mantenha design simples e reconhecível
- Teste em diferentes tamanhos
- Garanta contraste adequado

## Como Criar

1. **Usando ferramentas online:**
   - [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)

2. **Usando imagem existente:**
   - Use o logo do MusicLovely como base
   - Redimensione para os tamanhos necessários
   - Para maskable: adicione padding de 10% em cada lado

3. **Temporariamente:**
   - O sistema usará `/favicon.ico` como fallback
   - Funciona, mas não é ideal para PWA

## Validação

Após criar os ícones, valide:
- Lighthouse PWA score deve ser 100/100
- Ícones aparecem corretamente no manifest
- Teste instalação em Android e iOS

