import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';

  return {
    envDir: path.resolve(__dirname, '..'),
    // ✅ CRÍTICO: Base path explícito para garantir que funciona no Vercel
    base: '/',
    // ✅ CORREÇÃO: Garantir que a pasta public seja servida corretamente
    publicDir: 'public',
    server: {
      host: "localhost",
      port: 8089,
      // ✅ CORREÇÃO: Garantir que arquivos estáticos sejam servidos corretamente
      fs: {
        // Permitir servir arquivos da pasta public
        strict: false,
        allow: ['..'],
      },
      // ✅ FASE 4: Configurar HMR corretamente para WebSocket
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        // ✅ FASE 4: Desabilitar overlay de erros do HMR para evitar loops
        overlay: false, // Desabilitar overlay pode ajudar a evitar loops de recarregamento
      },
      // ✅ CORREÇÃO: Permitir acesso de outras portas (8087, etc.)
      strictPort: false,
      // ✅ FASE 4: Configurar watch para evitar loops de recarregamento
      watch: {
        // Ignorar mudanças que podem causar loops
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.cursor/**'],
        // ✅ FASE 4: Reduzir polling interval para evitar recarregamentos frequentes
        usePolling: false, // Desabilitar polling (usa eventos nativos do sistema)
      },
      headers: isDev ? {
        // CSP de desenvolvimento - amigável ao Vite/HMR
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://cdn.utmify.com.br https://connect.facebook.net https://*.facebook.net https://analytics.tiktok.com https://static.cloudflareinsights.com https://*.cloudflareinsights.com",
          "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.utmify.com.br https://connect.facebook.net https://*.facebook.net https://analytics.tiktok.com https://static.cloudflareinsights.com https://*.cloudflareinsights.com",
          "worker-src 'self' blob:",  // Permitir workers de blob
          "style-src 'self' 'unsafe-inline'",    // ok para Tailwind dev
          "img-src 'self' data: blob: https:",
          "media-src 'self' https://*.supabase.co blob:",  // Permitir áudio do Supabase Storage e blob
          "connect-src 'self' ws://localhost:8084 ws://localhost:* ws://127.0.0.1:* wss: https: http://localhost:* http://127.0.0.1:* https://*.supabase.co https://api.openai.com https://js.stripe.com https://*.utmify.com.br https://connect.facebook.net https://*.facebook.net",  // WebSocket HMR, UTMify tracking, Facebook e APIs (api.ipify.org removido - causa CORS)
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "child-src 'self' blob: data: https:",  // Permitir iframes e workers filhos
          "frame-src 'self' blob: data: https://js.stripe.com https://connect.facebook.net https://*.facebook.net https://www.facebook.com https://safeframe.googlesyndication.com",  // Stripe, Facebook e Google AdSense (UTMify)
        ].join('; ')
      } : undefined
    },
    plugins: [
      react(), 
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Alias para Stripe - retornar objeto vazio se tentar importar no frontend
        "stripe": path.resolve(__dirname, "./src/lib/stripe-stub.ts"),
      },
      // ✅ CORREÇÃO: Garantir que não há duplicação do React
      dedupe: ['react', 'react-dom'],
    },
    build: {
      // ✅ CORREÇÃO: Deixar Vite decidir automaticamente o code splitting
      // Code splitting manual estava causando problemas de carregamento
      rollupOptions: {
        onwarn(warning, warn) {
          // Suprimir avisos de scripts externos e bibliotecas backend
          if (warning.code === 'UNRESOLVED_IMPORT' || 
              warning.message?.includes('utmify') || 
              warning.message?.includes('pixel') ||
              warning.message?.includes('requests.js') ||
              warning.message?.includes('stripe') ||
              warning.code === 'EMPTY_BUNDLE') {
            return;
          }
          warn(warning);
        },
        // Externalizar Stripe completamente
        external: (id) => {
          if (id === 'stripe' || id.includes('stripe')) {
            return true;
          }
          return false;
        },
        // ✅ CORREÇÃO CRÍTICA: React NÃO deve ser separado em chunk - deve estar no bundle principal
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          manualChunks: (id) => {
            // ✅ CRÍTICO: NÃO separar React e React-DOM - manter no bundle principal
            // Isso garante que React esteja sempre disponível quando necessário
            if (id.includes('node_modules/react/') || 
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react/jsx-runtime') ||
                id.includes('node_modules/react/jsx-dev-runtime')) {
              // Retornar undefined = não criar chunk separado, incluir no bundle principal
              return undefined;
            }
            // Agrupar outras dependências grandes
            if (id.includes('node_modules')) {
              if (id.includes('@radix-ui')) {
                return 'vendor-radix';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-tanstack';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              // Outras dependências em um chunk separado
              return 'vendor';
            }
          },
        },
      },
      // Enable source maps for production debugging
      sourcemap: mode === 'development',
      // Optimize chunk size
      chunkSizeWarningLimit: 1500, // ✅ OTIMIZAÇÃO: Aumentado para 1500KB
      // Enable minification - usando esbuild para builds mais rápidos
      minify: 'esbuild', // Mais rápido que terser, especialmente em builds grandes
      // Alternativa: se precisar de terser, usar configuração mais leve
      // minify: 'terser',
      // terserOptions: {
      //   compress: {
      //     drop_console: mode === 'production',
      //     drop_debugger: mode === 'production',
      //     passes: 1 // Reduzido para 1 passada para acelerar build
      //   },
      //   format: {
      //     comments: false
      //   }
      // },
      // ✅ COMPATIBILIDADE: Usar ES2020 para suportar navegadores mais antigos
      // ES2020 suporta: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+
      // Inclui suporte para: optional chaining, nullish coalescing, dynamic import
      target: 'es2020',
      cssCodeSplit: true,
      reportCompressedSize: false // Acelera build
    },
    // ✅ FASE 4: Optimize dependencies para evitar loops de HMR
    optimizeDeps: {
      include: [
        // ✅ CRÍTICO: React e React-DOM PRIMEIRO na lista
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        // ✅ CORREÇÃO: Incluir todos os pacotes Radix UI para garantir que React esteja disponível
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-progress',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-dialog',
        '@radix-ui/react-accordion',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-avatar',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-context-menu',
        '@radix-ui/react-label',
        '@radix-ui/react-menubar',
        '@radix-ui/react-navigation-menu',
        '@radix-ui/react-popover',
        '@radix-ui/react-radio-group',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-select',
        '@radix-ui/react-separator',
        '@radix-ui/react-slider',
        '@radix-ui/react-slot',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toast',
        '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group',
        'buffer'
      ],
      exclude: [
        'stripe' // Excluir Stripe do frontend - só usado no backend
      ],
      // ✅ CORREÇÃO: Garantir que React seja deduplicado
      esbuildOptions: {
        // ✅ CRÍTICO: Garantir que React e React-DOM sejam tratados como externos durante otimização
        // Isso evita problemas com múltiplas instâncias
        mainFields: ['module', 'main'],
        // ✅ CRÍTICO: Garantir que React seja sempre resolvido corretamente
        resolveExtensions: ['.jsx', '.tsx', '.js', '.ts', '.json'],
      },
    },
  };
});
