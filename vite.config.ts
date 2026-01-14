import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { imagetools } from "vite-imagetools";
import { compression } from "vite-plugin-compression2";
import { injectScriptPlugin } from "./vite-plugin-inject-script";

export default defineConfig({
  plugins: [
    react(), 
    imagetools(),
    // Compression plugins movidos para o final para não interferir com o processamento do HTML
    compression({
      algorithm: 'gzip',
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    // ✅ CORREÇÃO CRÍTICA: Plugin para injetar script principal no HTML
    injectScriptPlugin(),
  ],
  // ✅ CORREÇÃO: Garantir base URL correto para produção
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ✅ CORREÇÃO: Configurações de servidor para evitar cache
  server: {
    // Forçar HMR (Hot Module Replacement) a funcionar corretamente
    hmr: {
      overlay: true,
    },
    // Desabilitar cache de headers
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  },
  // ✅ CORREÇÃO: Configuração de assets para garantir processamento correto
  assetsInclude: ["**/*.webp", "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg", "**/*.mp4", "**/*.webm"],
  build: {
    // Otimizações de compressão - usar terser para minificação mais agressiva
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2, // ✅ OTIMIZAÇÃO PRODUÇÃO: Múltiplas passadas para melhor compressão
        unsafe: true, // ✅ OTIMIZAÇÃO PRODUÇÃO: Otimizações não seguras (mas eficientes)
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        dead_code: true,
        unused: true,
      },
      format: {
        comments: false, // ✅ OTIMIZAÇÃO PRODUÇÃO: Remover todos os comentários
      },
    },
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Tree shaking mais agressivo
    rollupOptions: {
      input: './index.html', // ✅ CORREÇÃO CRÍTICA: Garantir que o index.html seja o entry point
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: (id) => {
          // Permitir side effects apenas para CSS e alguns módulos específicos
          return id.includes('.css') || id.includes('@radix-ui/react-toast');
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        // ✅ OTIMIZAÇÃO PRODUÇÃO: Compact output para reduzir tamanho
        compact: true,
        // ✅ OTIMIZAÇÃO PRODUÇÃO: Chunks menores para melhor cache
        experimentalMinChunkSize: 20000,
        // Chunks manuais para melhor cache e carregamento paralelo
        // ✅ CORREÇÃO CRÍTICA: Remover chunking manual problemático e usar estratégia mais segura
        // O Vite já faz code splitting automático eficiente, então vamos ser mais conservadores
        manualChunks: (id) => {
          // ✅ CORREÇÃO CRÍTICA: Não separar o entry point principal (main.tsx, App.tsx)
          // Isso garante que o código principal seja gerado como entry point
          if (id.includes('src/main.tsx') || id.includes('src/App.tsx') || id.includes('src/index.tsx')) {
            return undefined; // Deixar no chunk principal
          }
          
          // ✅ OTIMIZAÇÃO PERFORMANCE: Separar código não crítico em chunks menores
          // Separar i18n em chunk próprio (não crítico)
          if (id.includes("i18n") || id.includes("i18next") || id.includes("react-i18next")) {
            return "vendor-i18n";
          }
          
          // Separar error handlers (não crítico)
          if (id.includes("utils/errors")) {
            return "vendor-errors";
          }
          
          // ✅ OTIMIZAÇÃO: Separar admin em chunks menores por funcionalidade (não crítico para usuários)
          if (id.includes("pages/admin") || id.includes("components/admin")) {
            // Separar AdminDashboard e AdminLayout (mais pesados)
            if (id.includes("AdminDashboard") || id.includes("AdminLayout")) {
              return "vendor-admin-core";
            }
            // Separar AdminOrders e AdminOrderDetails
            if (id.includes("AdminOrder")) {
              return "vendor-admin-orders";
            }
            // Separar AdminSongs e AdminSongDetails
            if (id.includes("AdminSong")) {
              return "vendor-admin-songs";
            }
            // Resto do admin
            return "vendor-admin";
          }
          
          if (id.includes("node_modules")) {
            // Separar Supabase (carregar apenas quando necessário)
            if (id.includes("@supabase") && !id.includes("react")) {
              return "vendor-supabase";
            }
            // ✅ OTIMIZAÇÃO: Agrupar Radix UI em chunk único (reduzir número de chunks)
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Separar bibliotecas pesadas
            if (id.includes("recharts")) {
              return "vendor-recharts";
            }
            if (id.includes("date-fns")) {
              return "vendor-date-fns";
            }
            if (id.includes("react-router-dom")) {
              return "vendor-router";
            }
            if (id.includes("@tanstack/react-query")) {
              return "vendor-query";
            }
            // Outros vendors grandes
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // ✅ OTIMIZAÇÃO FASE 4.1: Separar zod e sonner em chunks próprios
            if (id.includes("zod")) {
              return "vendor-zod";
            }
            if (id.includes("sonner")) {
              return "vendor-sonner";
            }
            // ✅ OTIMIZAÇÃO: Agrupar outros vendors pequenos
            if (id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority")) {
              return "vendor-utils";
            }
            // Deixar React e tudo relacionado no chunk padrão
          }
          return undefined;
        },
        // Nomes de arquivos otimizados
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: (chunkInfo) => {
          // Garantir que o entry point principal seja gerado corretamente
          return chunkInfo.name === 'main' 
            ? "assets/js/main-[hash].js" 
            : "assets/js/[name]-[hash].js";
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split(".") || [];
          const ext = info[info.length - 1];
          // ✅ CORREÇÃO: Garantir que imagens sejam processadas corretamente
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext || "")) {
            // ✅ CORREÇÃO CRÍTICA: Usar hash mais curto e garantir que o nome seja preservado
            // Isso garante que os imports do Vite funcionem corretamente em produção
            const name = assetInfo.name?.replace(/\.[^/.]+$/, "") || "image";
            return `assets/img/${name}-[hash:8].[ext]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext || "")) {
            return "assets/fonts/[name]-[hash:8].[ext]";
          }
          return "assets/[ext]/[name]-[hash:8].[ext]";
        },
      },
    },
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Limite de aviso otimizado (500KB é razoável para chunks grandes)
    chunkSizeWarningLimit: 500,
    // Source maps apenas em dev (economia de ~30% no bundle)
    sourcemap: process.env.NODE_ENV === "development",
    // Code splitting de CSS
    cssCodeSplit: true,
    // Minificar CSS
    cssMinify: true,
    // ✅ OTIMIZAÇÃO PERFORMANCE: Otimizações adicionais
    modulePreload: {
      polyfill: false, // Não precisa de polyfill em navegadores modernos
    },
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Minificação mais agressiva de CSS
    cssMinifyOptions: {
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
      }],
    },
    // Otimizações adicionais
    target: "es2020", // Reduzir transpilação desnecessária
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Habilitar report de tamanhos comprimidos apenas em produção para análise
    reportCompressedSize: process.env.NODE_ENV === "production",
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Otimizar assets inline
    assetsInlineLimit: 4096, // Inline assets menores que 4KB
    // ✅ OTIMIZAÇÃO PERFORMANCE: Otimizações adicionais
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "frontend/**"],
  },
});
