import type { Plugin } from 'vite';
import type { Connect } from 'vite';

/**
 * Plugin para garantir MIME types corretos para arquivos JavaScript
 * Resolve o problema de "MIME type of ''" no servidor de preview
 */
export function mimeTypesPlugin(): Plugin {
  return {
    name: 'mime-types',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // ✅ CORREÇÃO: Garantir MIME type correto para arquivos JS
        if (req.url?.endsWith('.js') || req.url?.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        // ✅ CORREÇÃO: Garantir MIME type correto para arquivos JS no preview
        if (req.url?.endsWith('.js') || req.url?.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        next();
      });
    },
  };
}
