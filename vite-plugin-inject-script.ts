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
            .filter((f: string) => f.endsWith('.js') && !f.includes('.br') && !f.includes('.gz') && !f.includes('vendor-'))
            .map((f: string) => {
              const filePath = join(jsDir, f);
              const stats = statSync(filePath);
              return { name: f, size: stats.size };
            })
            .sort((a, b) => b.size - a.size);
          
          // Priorizar arquivo index (entry point principal)
          const mainFile = jsFiles.find(f => f.name.startsWith('index-')) || jsFiles[0];
          
          if (mainFile && !html.includes(mainFile.name)) {
            // ✅ CORREÇÃO: Adicionar script module correto com cache busting
            // Adicionar hash do arquivo como query parameter para forçar reload
            const fileHash = mainFile.name.match(/-([a-zA-Z0-9]+)\.js$/)?.[1] || '';
            const cacheBuster = fileHash ? `?v=${fileHash}` : `?t=${Date.now()}`;
            const scriptTag = `    <script type="module" crossorigin src="/assets/js/${mainFile.name}${cacheBuster}"></script>\n`;
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
        
        // ✅ CORREÇÃO: Remover referências a arquivos .tsx do HTML
        // O Vite não deve gerar arquivos .tsx em produção
        const tsxReference = html.match(/<link[^>]*href="\/assets\/tsx\/[^"]*\.tsx"[^>]*>/);
        if (tsxReference) {
          html = html.replace(tsxReference[0], '');
          writeFileSync(distIndexPath, html, 'utf-8');
        }
      } catch (error) {
        // Ignorar erros silenciosamente para não travar o build
        // O Vite geralmente já injeta o script corretamente
      }
    },
  };
}
