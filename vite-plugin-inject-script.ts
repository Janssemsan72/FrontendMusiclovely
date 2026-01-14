import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
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
      // ✅ OTIMIZAÇÃO: Verificar primeiro se Vite já injetou o script
      // Isso evita I/O desnecessário se o Vite já fez o trabalho
      const distIndexPath = join(process.cwd(), 'dist', 'index.html');
      try {
        let html = readFileSync(distIndexPath, 'utf-8');
        
        // Verificar se o Vite já injetou o script principal
        const viteInjectedScript = html.match(/<script[^>]*type="module"[^>]*src="\/assets\/js\/[^"]*\.js"[^>]*>/);
        
        if (viteInjectedScript) {
          // Vite já fez o trabalho, não precisa fazer nada
          return;
        }
        
        // Se Vite não injetou, tentar injetar manualmente
        const jsDir = join(process.cwd(), 'dist', 'assets', 'js');
        
        // Verificar se o diretório existe antes de tentar ler
        try {
          const files = readdirSync(jsDir);
          const jsFiles = files
            .filter((f: string) => f.endsWith('.js') && !f.includes('.br') && !f.includes('.gz'))
            .map((f: string) => {
              const filePath = join(jsDir, f);
              const stats = statSync(filePath);
              return { name: f, size: stats.size };
            })
            .sort((a, b) => b.size - a.size);
          
          // Priorizar arquivos não-vendor, mas se não houver, usar o maior
          const mainFile = jsFiles.find(f => !f.name.includes('vendor-')) || jsFiles[0];
          
          if (mainFile && !html.includes(mainFile.name)) {
            // ✅ CORREÇÃO: Adicionar defer para não bloquear parsing
            const scriptTag = `    <script type="module" src="/assets/js/${mainFile.name}" defer></script>\n`;
            const bodyEndIndex = html.lastIndexOf('</body>');
            
            if (bodyEndIndex !== -1) {
              html = html.slice(0, bodyEndIndex) + scriptTag + html.slice(bodyEndIndex);
              writeFileSync(distIndexPath, html, 'utf-8');
            }
          }
        } catch (e) {
          // Se não conseguir ler o diretório, não é crítico - Vite provavelmente já injetou
          // Não fazer nada para evitar travamentos
        }
      } catch (error) {
        // Ignorar erros silenciosamente para não travar o build
        // O Vite geralmente já injeta o script corretamente
      }
    },
  };
}
