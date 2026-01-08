import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Usar esbuild para minificação mais rápida (mais rápido que terser)
    minify: "esbuild",
    // Configurações de minificação do esbuild
    esbuildOptions: {
      // Remover console.log, console.info, console.debug em produção
      drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    },
    // Code splitting inteligente
    rollupOptions: {
      output: {
        // Chunks manuais para melhor cache e carregamento paralelo
        manualChunks: (id) => {
          // Vendor chunks separados para melhor cache
          if (id.includes("node_modules")) {
            // React core
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            // UI libraries
            if (id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            // Query library
            if (id.includes("@tanstack/react-query")) {
              return "vendor-query";
            }
            // Supabase
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            // i18n
            if (id.includes("react-i18next") || id.includes("i18next")) {
              return "vendor-i18n";
            }
            // Lucide icons (será otimizado na Fase 2)
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // Outros vendors
            return "vendor-other";
          }
        },
        // Nomes de arquivos otimizados
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split(".") || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext || "")) {
            return "assets/img/[name]-[hash].[ext]";
          }
          if (/woff2?|eot|ttf|otf/i.test(ext || "")) {
            return "assets/fonts/[name]-[hash].[ext]";
          }
          return "assets/[ext]/[name]-[hash].[ext]";
        },
      },
    },
    // Limite de aviso de tamanho de chunk
    chunkSizeWarningLimit: 1000,
    // Source maps apenas em dev (economia de ~30% no bundle)
    sourcemap: process.env.NODE_ENV === "development",
    // Code splitting de CSS
    cssCodeSplit: true,
    // Minificar CSS
    cssMinify: true,
    // Otimizações adicionais
    target: "esnext",
    // Reportar tamanhos de chunks
    reportCompressedSize: false, // Desabilitar para builds mais rápidos
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "frontend/**"],
  },
});
