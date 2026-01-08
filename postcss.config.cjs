module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
  // ✅ CORREÇÃO: Adicionar opção 'from' para evitar warning do PostCSS
  from: undefined,
};
