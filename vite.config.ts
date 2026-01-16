import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { imagetools } from "vite-imagetools";
// ✅ OTIMIZAÇÃO: Removido compression - Vercel já faz compressão automática
// Isso acelera significativamente o build
// import { compression } from "vite-plugin-compression2";
import { injectScriptPlugin } from "./vite-plugin-inject-script";
import { mimeTypesPlugin } from "./vite-plugin-mime-types";

export default defineConfig({
  plugins: [
    react(), 
    imagetools(),
    // ✅ OTIMIZAÇÃO: Removido compression - Vercel já faz compressão automática
    // Isso elimina processamento duplo e acelera o build significativamente
    // compression({
    //   algorithm: 'gzip',
    //   exclude: [/\.(br)$/, /\.(gz)$/],
    // }),
    // compression({
    //   algorithm: 'brotliCompress',
    //   exclude: [/\.(br)$/, /\.(gz)$/],
    // }),
    // ✅ CORREÇÃO CRÍTICA: Plugin para garantir MIME types corretos
    mimeTypesPlugin(),
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
  // ✅ CORREÇÃO: Definir BUILD_ID para garantir hashes únicos
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || Date.now().toString()),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    // ✅ OTIMIZAÇÃO: Usar esbuild ao invés de terser - muito mais rápido e estável
    // esbuild é significativamente mais rápido que terser e evita travamentos
    minify: "esbuild",
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Tree shaking mais agressivo
    rollupOptions: {
      input: './index.html', // ✅ CORREÇÃO CRÍTICA: Garantir que o index.html seja o entry point
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: (id) => {
          // ✅ FASE 3: Tree-shaking mais agressivo para reduzir bundle
          // Pacotes que podem ser tree-shaken completamente
          if (id.includes('lucide-react')) {
            return false; // Lucide-react pode ser tree-shaken completamente
          }
          if (id.includes('date-fns')) {
            return false; // date-fns tem tree-shaking perfeito
          }
          if (id.includes('zod') && !id.includes('zod/lib')) {
            return false; // Zod pode ser tree-shaken
          }
          
          if (id.includes('src/') || id.includes('.css')) {
            // Apenas código crítico precisa de side effects
            if (id.includes('src/main.tsx') || id.includes('src/App.tsx') || id.includes('src/index.tsx')) {
              return true;
            }
            // ✅ CORREÇÃO CRÍTICA: Admin NÃO pode ser tree-shaken - precisa manter side effects
            // O código admin tem hooks, contextos e efeitos que precisam ser preservados
            if (id.includes('src/pages/admin') || id.includes('src/components/admin')) {
              return true; // Admin PRECISA de side effects para funcionar
            }
            if (id.includes('src/pages/Quiz') || id.includes('src/pages/Checkout')) {
              return false; // Quiz e Checkout podem ser tree-shaken
            }
            return true; // Outro código fonte precisa de side effects
          }
          
          // Permitir side effects apenas para módulos que realmente precisam
          if (id.includes('@radix-ui/react-toast')) {
            return true; // Toast precisa de side effects
          }
          
          // Por padrão, assumir que não há side effects (tree-shaking mais agressivo)
          return false;
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        // ✅ FASE 3: Otimizações adicionais de tree-shaking
        unknownGlobalSideEffects: false,
      },
      output: {
        // ✅ OTIMIZAÇÃO PRODUÇÃO: Compact output para reduzir tamanho
        compact: true,
        // ✅ CORREÇÃO: Remover experimentalMinChunkSize que pode estar impedindo geração de chunks
        // experimentalMinChunkSize: 20000, // Comentado - estava impedindo geração de arquivos JS
        // ✅ FASE 4: Melhorar code splitting para reduzir bundle inicial
        manualChunks: (id) => {
          if (id.includes('src/') && !id.includes('node_modules')) {
            if (id.includes('src/pages/Quiz') || id.includes('src/pages/QuizSteps')) {
              return "quiz"; // Quiz carrega sob demanda
            }
            if (id.includes('src/pages/Checkout')) {
              return "checkout"; // Checkout carrega sob demanda
            }
            // Deixar código crítico (Index, Header, HeroSection) no chunk principal
            return undefined;
          }
          
          // Separar node_modules grandes
          if (id.includes("node_modules")) {
            // ✅ CORREÇÃO: React deve estar no chunk principal para Radix UI funcionar
            if (id.includes("react") || id.includes("react-dom") || id.includes("react/jsx-runtime")) {
              return undefined; // React no chunk principal
            }
            if (id.includes("@radix-ui")) {
              return undefined; // Deixar Radix UI no chunk principal com React
            }
            // ✅ CORREÇÃO CIRCULAR: Incluir dependências do admin dentro do chunk admin
            // Isso evita dependências circulares (admin -> vendor -> admin)
            if (id.includes("recharts")) {
              return "admin"; // Recharts usado principalmente no admin
            }
            if (id.includes("react-day-picker")) {
              return "admin"; // Date picker usado principalmente no admin
            }
            // ✅ CORREÇÃO CRÍTICA: Supabase usado no admin - garantir que está disponível
            // Se admin precisar de Supabase, incluir no chunk admin para evitar problemas
            if (id.includes("@supabase")) {
              // Verificar se estamos em contexto admin - se sim, incluir no chunk admin
              // Caso contrário, manter separado
              return "vendor-supabase";
            }
            // Separar outras bibliotecas que não são do admin
            if (id.includes('date-fns') && !id.includes('react-day-picker')) {
              return 'vendor-date-fns';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }
            if (id.includes("@tanstack/react-query")) {
              return "vendor-query"; // ✅ OTIMIZAÇÃO: Separar React Query para code splitting
            }
            if (id.includes("zod")) {
              return "vendor-zod"; // ✅ OTIMIZAÇÃO: Separar Zod para code splitting
            }
            if (id.includes("react-router") || id.includes("@remix-run/router")) {
              return "vendor-router"; // ✅ OTIMIZAÇÃO: Separar React Router para code splitting
            }
            // Deixar React e resto no chunk principal
          }
          return undefined;
        },
        // Nomes de arquivos otimizados
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
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
    // ✅ OTIMIZAÇÃO PERFORMANCE: Limite de aviso reduzido para chunks menores (300KB)
    chunkSizeWarningLimit: 300,
    // ✅ OTIMIZAÇÃO PERFORMANCE: Otimizar carregamento de fontes
    assetsInlineLimit: 4096, // Inline assets menores que 4KB
    // ✅ OTIMIZAÇÃO PERFORMANCE: Source maps apenas em dev (economia de ~30% no bundle)
    // Garantir que NODE_ENV está definido corretamente
    sourcemap: process.env.NODE_ENV !== "production",
    // ✅ OTIMIZAÇÃO PERFORMANCE: CSS code splitting para reduzir bundle inicial
    cssCodeSplit: true,
    // ✅ OTIMIZAÇÃO PERFORMANCE: Minificar CSS agressivamente
    cssMinify: true,
    // ✅ OTIMIZAÇÃO PERFORMANCE: Otimizações adicionais
    modulePreload: {
      polyfill: false, // Não precisa de polyfill em navegadores modernos
    },
    // Otimizações adicionais
    target: "es2020", // Reduzir transpilação desnecessária
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Habilitar report de tamanhos comprimidos apenas em produção para análise
    reportCompressedSize: process.env.NODE_ENV === "production",
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
