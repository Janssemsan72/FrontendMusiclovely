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
          // ✅ CORREÇÃO: Verificar se o script injetado pelo Vite tem versionamento
          const buildId = process.env.BUILD_ID || Date.now().toString();
          const scriptMatch = viteInjectedScript[0];
          
          // Se o script não tem query parameter, adicionar BUILD_ID
          if (!scriptMatch.includes('?v=') && !scriptMatch.includes('?t=')) {
            const scriptPath = scriptMatch.match(/src="([^"]+)"/)?.[1];
            if (scriptPath) {
              const fileHash = scriptPath.match(/-([a-zA-Z0-9]+)\.js/)?.[1] || '';
              const versionedScript = scriptMatch.replace(
                /src="([^"]+)"/,
                `src="$1?v=${buildId}-${fileHash}"`
              );
              html = html.replace(scriptMatch, versionedScript);
              writeFileSync(distIndexPath, html, 'utf-8');
            }
          }
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
            // ✅ CORREÇÃO: Adicionar script module correto com cache busting usando BUILD_ID
            const buildId = process.env.BUILD_ID || Date.now().toString();
            const fileHash = mainFile.name.match(/-([a-zA-Z0-9]+)\.js$/)?.[1] || '';
            // Usar BUILD_ID + hash do arquivo para garantir unicidade
            const cacheBuster = `?v=${buildId}-${fileHash}`;
            const scriptTag = `    <script type="module" crossorigin src="/assets/js/${mainFile.name}${cacheBuster}"></script>\n`;
            const bodyEndIndex = html.lastIndexOf('</body>');
            
            if (bodyEndIndex !== -1) {
              html = html.slice(0, bodyEndIndex) + scriptTag + html.slice(bodyEndIndex);
              writeFileSync(distIndexPath, html, 'utf-8');
            }
          }
          
          // ✅ CORREÇÃO: Atualizar scripts existentes com BUILD_ID se não tiverem
          const existingScripts = html.match(/<script[^>]*src="\/assets\/js\/(index-[^"]+\.js)"[^>]*>/g);
          if (existingScripts) {
            const buildId = process.env.BUILD_ID || Date.now().toString();
            existingScripts.forEach(scriptTag => {
              // Se o script não tem query parameter, adicionar BUILD_ID
              if (!scriptTag.includes('?v=') && !scriptTag.includes('?t=')) {
                const scriptPath = scriptTag.match(/src="([^"]+)"/)?.[1];
                if (scriptPath && scriptPath.includes('index-')) {
                  const fileHash = scriptPath.match(/index-([a-zA-Z0-9]+)\.js/)?.[1] || '';
                  const newScriptTag = scriptTag.replace(
                    /src="([^"]+)"/,
                    `src="$1?v=${buildId}-${fileHash}"`
                  );
                  html = html.replace(scriptTag, newScriptTag);
                }
              }
            });
            writeFileSync(distIndexPath, html, 'utf-8');
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
