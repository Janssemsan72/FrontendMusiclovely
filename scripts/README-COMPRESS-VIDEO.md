# 🎬 Compressão de Vídeo - Hero Section

## 📋 Sobre

Este script comprime o vídeo do hero section (`musiclovaly.webm`) para reduzir significativamente o tamanho do arquivo, melhorando o tempo de carregamento da página inicial.

## ⚙️ Requisitos

- **FFmpeg** instalado no sistema
  - Windows: Baixe de https://ffmpeg.org/download.html
  - Ou instale via Chocolatey: `choco install ffmpeg`
  - Ou via Scoop: `scoop install ffmpeg`

## 🚀 Como Usar

### 1. Executar o Script

```powershell
cd frontend
.\scripts\compress-video.ps1
```

### 2. O que o Script Faz

1. ✅ Cria backup do vídeo original (`musiclovaly-backup.webm`)
2. ✅ Comprime o vídeo com configurações agressivas:
   - Codec: VP9 (melhor compressão)
   - CRF: 40 (qualidade reduzida, arquivo menor)
   - Resolução máxima: 1280x720
   - FPS: 30
   - Sem áudio (já está muted)
3. ✅ Substitui o vídeo original pelo comprimido
4. ✅ Mostra estatísticas de redução de tamanho

### 3. Resultado Esperado

- **Redução de tamanho:** 50-70% menor
- **Qualidade:** Ainda aceitável para hero section (background)
- **Tempo de carregamento:** Significativamente mais rápido

## 🔧 Configurações de Compressão

O script usa as seguintes configurações do FFmpeg:

```bash
-c:v libvpx-vp9      # Codec VP9 (melhor compressão)
-crf 40              # Qualidade (0-63, maior = menor arquivo)
-speed 4             # Velocidade de encoding (0-5, maior = mais rápido)
-vf scale='min(1280,iw)':'min(720,ih)'  # Resolução máxima 1280x720
-r 30                # FPS máximo 30
-an                  # Sem áudio
```

## 📊 Exemplo de Resultado

```
📊 Tamanho original: 0.44 MB
📊 Tamanho comprimido: 0.15 MB
📉 Redução: 65.9%
```

## ⚠️ Importante

- O script **cria um backup** automaticamente antes de comprimir
- Se algo der errado, você pode restaurar o backup
- Teste o vídeo comprimido antes de fazer commit
- Se a qualidade ficar muito baixa, ajuste o CRF no script (valores menores = melhor qualidade)

## 🔄 Restaurar Backup

Se precisar restaurar o vídeo original:

```powershell
cd frontend\public\video
Move-Item musiclovaly-backup.webm musiclovaly.webm -Force
```

## 🎯 Otimizações Adicionais no Código

Além da compressão do arquivo, o código foi otimizado para:

1. **Lazy Loading:** Vídeo só carrega quando está visível (Intersection Observer)
2. **Preload "metadata":** Carrega apenas metadados inicialmente, não o vídeo completo
3. **Poster Image:** Mostra imagem estática enquanto o vídeo carrega
4. **Fallback:** Sistema de fallback para MP4 caso WebM falhe

## 📝 Notas

- O vídeo comprimido pode ter qualidade visual ligeiramente inferior
- Para hero sections, isso geralmente é aceitável
- Se precisar de melhor qualidade, reduza o CRF para 35 ou 30

