import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Plugin para garantir que o script principal seja injetado no HTML
 * Isso resolve o problema do Vite não injetar automaticamente o script
 */
export function injectScriptPlugin(): Plugin {
  return {
    name: 'inject-script',
    enforce: 'post',
    writeBundle() {
      // Após o build, injetar o script no HTML
      const distIndexPath = join(process.cwd(), 'dist', 'index.html');
      try {
        let html = readFileSync(distIndexPath, 'utf-8');
        
        // Encontrar o arquivo JS principal
        // Se não houver arquivo não-vendor, usar o maior vendor (React geralmente)
        const jsDir = join(process.cwd(), 'dist', 'assets', 'js');
        let jsFiles: { name: string; size: number }[] = [];
        
        try {
          const files = readdirSync(jsDir);
          jsFiles = files
            .filter((f: string) => f.endsWith('.js'))
            .map((f: string) => {
              const filePath = join(jsDir, f);
              const stats = require('fs').statSync(filePath);
              return { name: f, size: stats.size };
            })
            .sort((a, b) => b.size - a.size);
        } catch (e) {
          console.warn('Não foi possível ler diretório de JS:', e);
          return;
        }
        
        // Priorizar arquivos não-vendor, mas se não houver, usar o maior vendor
        const mainFile = jsFiles.find(f => !f.name.includes('vendor-')) || jsFiles[0];
        
        if (mainFile && !html.includes(mainFile.name)) {
          // Injetar o script antes do fechamento do body
          const scriptTag = `    <script type="module" src="/assets/js/${mainFile.name}"></script>\n`;
          
          // Inserir antes do último </body>
          const bodyEndIndex = html.lastIndexOf('</body>');
          if (bodyEndIndex !== -1) {
            html = html.slice(0, bodyEndIndex) + scriptTag + html.slice(bodyEndIndex);
            writeFileSync(distIndexPath, html, 'utf-8');
            console.log(`✅ Script injetado: /assets/js/${mainFile.name}`);
          } else {
            console.warn('❌ Não foi possível encontrar </body> no HTML');
          }
        } else if (mainFile) {
          console.log(`ℹ️ Script já existe no HTML: ${mainFile.name}`);
        } else {
          console.warn('❌ Nenhum arquivo JS encontrado para injetar');
        }
      } catch (error) {
        console.error('Erro ao injetar script:', error);
      }
    },
  };
}
