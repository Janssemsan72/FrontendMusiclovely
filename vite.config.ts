import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { imagetools } from "vite-imagetools";
// ✅ OTIMIZAÇÃO: Removido compression - Vercel já faz compressão automática
// Isso acelera significativamente o build
// import { compression } from "vite-plugin-compression2";
import { injectScriptPlugin } from "./vite-plugin-inject-script";

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
    // ✅ OTIMIZAÇÃO: Usar esbuild ao invés de terser - muito mais rápido e estável
    // esbuild é significativamente mais rápido que terser e evita travamentos
    minify: "esbuild",
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Tree shaking mais agressivo
    rollupOptions: {
      input: './index.html', // ✅ CORREÇÃO CRÍTICA: Garantir que o index.html seja o entry point
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: (id) => {
          // ✅ OTIMIZAÇÃO: Tree-shaking mais agressivo para reduzir bundle
          if (id.includes('src/') || id.includes('.css')) {
            // Apenas código crítico precisa de side effects
            if (id.includes('src/main.tsx') || id.includes('src/App.tsx') || id.includes('src/index.tsx')) {
              return true;
            }
            // Código admin/quiz pode ser tree-shaken se não usado
            if (id.includes('src/pages/admin') || id.includes('src/components/admin')) {
              return false; // Admin pode ser tree-shaken
            }
            return true; // Outro código fonte precisa de side effects
          }
          // Permitir side effects para alguns módulos específicos
          return id.includes('@radix-ui/react-toast');
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        // ✅ OTIMIZAÇÃO PRODUÇÃO: Compact output para reduzir tamanho
        compact: true,
        // ✅ CORREÇÃO: Remover experimentalMinChunkSize que pode estar impedindo geração de chunks
        // experimentalMinChunkSize: 20000, // Comentado - estava impedindo geração de arquivos JS
        // ✅ OTIMIZAÇÃO PERFORMANCE: Melhorar code splitting para reduzir bundle inicial
        manualChunks: (id) => {
          // ✅ CRÍTICO: Separar código admin e quiz (não crítico para primeira renderização)
          if (id.includes('src/') && !id.includes('node_modules')) {
            if (id.includes('src/pages/admin') || id.includes('src/components/admin')) {
              return "admin"; // Admin carrega sob demanda
            }
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
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (id.includes("recharts")) {
              return "vendor-recharts";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons"; // Ícones podem ser carregados sob demanda
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
    // ✅ OTIMIZAÇÃO PRODUÇÃO: Limite de aviso otimizado (500KB é razoável para chunks grandes)
    chunkSizeWarningLimit: 500,
    // ✅ OTIMIZAÇÃO PERFORMANCE: Otimizar carregamento de fontes
    assetsInlineLimit: 4096, // Inline assets menores que 4KB
    // Source maps apenas em dev (economia de ~30% no bundle)
    sourcemap: process.env.NODE_ENV === "development",
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
