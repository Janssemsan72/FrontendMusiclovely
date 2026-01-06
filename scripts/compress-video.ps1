# Script para comprimir vídeo do hero section
# Requer FFmpeg instalado: https://ffmpeg.org/download.html

$videoPath = "public\video\musiclovaly.webm"
$outputPath = "public\video\musiclovaly-compressed.webm"
$backupPath = "public\video\musiclovaly-backup.webm"

Write-Host "🎬 Comprimindo vídeo do hero section..." -ForegroundColor Cyan

# Verificar se FFmpeg está instalado
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    Write-Host "❌ FFmpeg não encontrado!" -ForegroundColor Red
    Write-Host "📥 Instale FFmpeg: https://ffmpeg.org/download.html" -ForegroundColor Yellow
    exit 1
}

# Verificar se o vídeo existe
if (-not (Test-Path $videoPath)) {
    Write-Host "❌ Vídeo não encontrado: $videoPath" -ForegroundColor Red
    exit 1
}

# Criar backup
Write-Host "📦 Criando backup..." -ForegroundColor Yellow
Copy-Item $videoPath $backupPath -Force

# Obter tamanho original
$originalSize = (Get-Item $videoPath).Length / 1MB
Write-Host "📊 Tamanho original: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Cyan

# Comprimir vídeo com configurações agressivas
Write-Host "⚙️ Comprimindo vídeo (isso pode levar alguns minutos)..." -ForegroundColor Yellow

# Configurações de compressão agressiva:
# - VP9 codec (melhor compressão que VP8)
# - CRF 40 (qualidade menor = arquivo menor, escala 0-63)
# - Velocidade 4 (mais rápido, menos qualidade)
# - Resolução máxima 1280x720 (reduz se maior)
# - FPS 30 (reduz se maior)
# - Sem áudio (já está muted)
ffmpeg -i $videoPath `
    -c:v libvpx-vp9 `
    -crf 40 `
    -b:v 0 `
    -speed 4 `
    -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" `
    -r 30 `
    -an `
    -threads 4 `
    -y `
    $outputPath

if ($LASTEXITCODE -eq 0) {
    $newSize = (Get-Item $outputPath).Length / 1MB
    $reduction = (($originalSize - $newSize) / $originalSize) * 100
    
    Write-Host "✅ Compressão concluída!" -ForegroundColor Green
    Write-Host "📊 Tamanho original: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Cyan
    Write-Host "📊 Tamanho comprimido: $([math]::Round($newSize, 2)) MB" -ForegroundColor Green
    Write-Host "📉 Redução: $([math]::Round($reduction, 1))%" -ForegroundColor Yellow
    
    # Substituir original pelo comprimido
    Write-Host "🔄 Substituindo vídeo original..." -ForegroundColor Yellow
    Move-Item $outputPath $videoPath -Force
    
    Write-Host "✅ Vídeo comprimido e substituído com sucesso!" -ForegroundColor Green
    Write-Host "💾 Backup salvo em: $backupPath" -ForegroundColor Cyan
} else {
    Write-Host "❌ Erro ao comprimir vídeo!" -ForegroundColor Red
    exit 1
}

