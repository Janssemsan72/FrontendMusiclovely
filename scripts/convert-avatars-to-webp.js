const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '../frontend/node_modules/sharp'));

async function convertAvatar(inputPath, outputPath, thumbnailPath, size = 512) {
  try {
    // Converter para WebP e redimensionar para tamanho padrão
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 90 })
      .toFile(outputPath);
    
    console.log(`✅ Convertido: ${path.basename(outputPath)}`);
    
    // Criar versão thumbnail 96x96
    await sharp(inputPath)
      .resize(96, 96, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 85 })
      .toFile(thumbnailPath);
    
    console.log(`✅ Thumbnail criado: ${path.basename(thumbnailPath)}`);
    
    // Remover arquivo temporário
    fs.unlinkSync(inputPath);
    console.log(`🗑️  Removido arquivo temporário: ${path.basename(inputPath)}`);
    
  } catch (error) {
    console.error(`❌ Erro ao converter ${inputPath}:`, error);
    throw error;
  }
}

async function main() {
  const assetsDir = path.join(__dirname, '../src/assets');
  
  try {
    console.log('🔄 Convertendo avatares para WebP...\n');
    
    // Converter avatar de Ana Silva (testimonial-1)
    const anaInput = path.join(assetsDir, 'testimonial-1-temp.jpg');
    const anaOutput = path.join(assetsDir, 'testimonial-1.webp');
    const anaThumb = path.join(assetsDir, 'testimonial-1-96.webp');
    
    if (fs.existsSync(anaInput)) {
      console.log('📸 Processando avatar de Ana Silva...');
      await convertAvatar(anaInput, anaOutput, anaThumb);
      console.log('');
    } else {
      console.warn('⚠️  Arquivo não encontrado: testimonial-1-temp.jpg');
    }
    
    // Converter avatar de Mariana Costa (testimonial-3)
    const marianaInput = path.join(assetsDir, 'testimonial-3-temp.jpg');
    const marianaOutput = path.join(assetsDir, 'testimonial-3.webp');
    const marianaThumb = path.join(assetsDir, 'testimonial-3-96.webp');
    
    if (fs.existsSync(marianaInput)) {
      console.log('📸 Processando avatar de Mariana Costa...');
      await convertAvatar(marianaInput, marianaOutput, marianaThumb);
      console.log('');
    } else {
      console.warn('⚠️  Arquivo não encontrado: testimonial-3-temp.jpg');
    }
    
    console.log('✅ Conversão concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante a conversão:', error);
    process.exit(1);
  }
}

main();
