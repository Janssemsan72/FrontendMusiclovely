import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar apenas tradução em português
// ✅ CORREÇÃO VERCEL: Usar import direto (Vite suporta importação de JSON nativamente)
import pt from './locales/pt.json';

// Configuração do i18next - apenas português
// ✅ CRÍTICO: Inicializar de forma síncrona para garantir que está pronto antes de qualquer uso
i18n
  .use(initReactI18next)
  .init({
    // Recursos de tradução - apenas português
    resources: {
      pt: { translation: pt },
    },
    
    // Idioma padrão - português fixo
    fallbackLng: 'pt',
    lng: 'pt', // Forçar português sempre
    
    // Idioma de debug (desenvolvimento)
    debug: false,
    
    // Configurações de interpolação
    interpolation: {
      escapeValue: false, // React já faz escape
    },
    
    // Configurações de namespace
    defaultNS: 'translation',
    ns: ['translation'],
    
    // Configurações de react
    react: {
      useSuspense: false,
    },
    
    // ✅ CRÍTICO: Inicialização síncrona
    initImmediate: true,
  })
  .then(() => {
    // Garantir que está em português
    i18n.changeLanguage('pt');
  })
  .catch((err) => {
    console.error('❌ [i18n] Erro ao inicializar i18n:', err);
  });

export default i18n;
