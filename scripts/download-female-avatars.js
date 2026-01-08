const https = require('https');
const fs = require('fs');
const path = require('path');

// URLs de avatares femininos usando randomuser.me API
const avatarUrls = {
  ana: 'https://randomuser.me/api/?gender=female&nat=br&results=1',
  mariana: 'https://randomuser.me/api/?gender=female&nat=br&results=1'
};

async function fetchAvatarUrl(apiUrl) {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const photoUrl = json.results[0].picture.large;
          resolve(photoUrl);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('🔍 Buscando URLs de avatares femininos...');
    
    // Buscar URL para Ana Silva
    console.log('📥 Baixando avatar para Ana Silva...');
    const anaUrl = await fetchAvatarUrl(avatarUrls.ana);
    await downloadImage(anaUrl, path.join(__dirname, '../src/assets/testimonial-1-temp.jpg'));
    console.log('✅ Avatar de Ana Silva baixado');
    
    // Aguardar um pouco para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Buscar URL para Mariana Costa
    console.log('📥 Baixando avatar para Mariana Costa...');
    const marianaUrl = await fetchAvatarUrl(avatarUrls.mariana);
    await downloadImage(marianaUrl, path.join(__dirname, '../src/assets/testimonial-3-temp.jpg'));
    console.log('✅ Avatar de Mariana Costa baixado');
    
    console.log('\n✅ Todos os avatares foram baixados!');
    console.log('⚠️  NOTA: As imagens estão em JPG. Você precisará convertê-las para WebP manualmente.');
    console.log('   Use uma ferramenta online como https://convertio.co/jpg-webp/ ou ImageMagick');
    
  } catch (error) {
    console.error('❌ Erro ao baixar avatares:', error);
    process.exit(1);
  }
}

main();
