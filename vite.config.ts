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
        // ✅ CORREÇÃO: Usar estratégia mais conservadora para garantir que React funcione
        manualChunks: (id) => {
          // Apenas separar vendors grandes, mantendo React seguro
          if (id.includes("node_modules")) {
            // React core - verificar primeiro com múltiplas condições
            const isReact = id.includes("node_modules/react/") || 
                           id.includes("node_modules/react-dom/") ||
                           (id.includes("/react/") && !id.includes("react-router") && !id.includes("react-i18next") && !id.includes("react-query"));
            
            if (isReact) {
              return "vendor-react";
            }
            
            // Outros vendors grandes apenas
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("react-i18next") || id.includes("/i18next/")) return "vendor-i18n";
            if (id.includes("lucide-react")) return "vendor-icons";
            
            // Deixar o resto no chunk padrão (não forçar vendor-other)
            // Isso evita problemas de dependências
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
