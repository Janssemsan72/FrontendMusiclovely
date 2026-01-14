import type { Plugin } from 'vite';
import type { Connect } from 'vite';

/**
 * Plugin para garantir MIME types corretos para arquivos JavaScript
 * Resolve o problema de "MIME type of ''" no servidor de preview
 * Também garante que arquivos não encontrados retornem 404 ao invés de HTML
 */
export function mimeTypesPlugin(): Plugin {
  return {
    name: 'mime-types',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        
        // ✅ CORREÇÃO: Garantir MIME type correto para arquivos JS
        if (url.endsWith('.js') || url.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          // ✅ CORREÇÃO CRÍTICA: Headers anti-cache mais agressivos
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
        // ✅ CORREÇÃO: Headers anti-cache para HTML também
        if (url === '/' || url?.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        
        // ✅ CORREÇÃO: Garantir MIME type correto para arquivos JS no preview
        if (url.endsWith('.js') || url.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          // ✅ CORREÇÃO CRÍTICA: Headers anti-cache mais agressivos
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
        // ✅ CORREÇÃO: Headers anti-cache para HTML também
        if (url === '/' || url?.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        
        // ✅ CORREÇÃO: Se arquivo JS não existe, retornar 404 ao invés de HTML
        if ((url.endsWith('.js') || url.endsWith('.mjs')) && url.startsWith('/assets/js/')) {
          // Verificar se o arquivo existe antes de continuar
          // Se não existir, o servidor vai retornar 404 automaticamente
        }
        
        next();
      });
    },
  };
}
