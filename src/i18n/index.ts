import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar apenas tradução em português
// ✅ CORREÇÃO VERCEL: Usar import direto (Vite suporta importação de JSON nativamente)
import pt from './locales/pt.json';

// ✅ CORREÇÃO CRÍTICA: Fallback básico caso o import falhe em produção
const fallbackTranslations = {
  notFound: {
    title: 'Página não encontrada',
    description: 'A página que você está procurando não existe ou foi movida.',
    backHome: 'Voltar para Home',
    goBack: 'Voltar'
  }
};

// ✅ CORREÇÃO: Garantir que pt seja um objeto válido
const ptTranslations = pt && typeof pt === 'object' ? pt : fallbackTranslations;

// Configuração do i18next - apenas português
// ✅ CRÍTICO: Inicializar de forma síncrona para garantir que está pronto antes de qualquer uso
try {
  i18n
    .use(initReactI18next)
    .init({
      // Recursos de tradução - apenas português
      resources: {
        pt: { translation: ptTranslations },
      },
      
      // Idioma padrão - português fixo
      fallbackLng: 'pt',
      lng: 'pt', // Forçar português sempre
      
      // ✅ CORREÇÃO: Fallback mais robusto
      fallbackNS: 'translation',
      
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
      
      // ✅ CORREÇÃO: Garantir que retorna a chave se tradução não encontrada (para debug)
      returnNull: false,
      returnEmptyString: false,
      returnObjects: false,
    })
    .then(() => {
      // Garantir que está em português
      i18n.changeLanguage('pt').catch(() => {
        // Ignorar erro se já estiver em pt
      });
    })
    .catch((err) => {
      console.error('❌ [i18n] Erro ao inicializar i18n:', err);
      // Tentar inicializar com fallback mínimo
      try {
        i18n.addResourceBundle('pt', 'translation', fallbackTranslations, true, true);
      } catch (fallbackErr) {
        console.error('❌ [i18n] Erro ao adicionar fallback:', fallbackErr);
      }
    });
} catch (initError) {
  console.error('❌ [i18n] Erro crítico ao inicializar i18n:', initError);
  // Tentar inicializar com configuração mínima
  try {
    i18n
      .use(initReactI18next)
      .init({
        resources: {
          pt: { translation: fallbackTranslations },
        },
        fallbackLng: 'pt',
        lng: 'pt',
        initImmediate: true,
        react: {
          useSuspense: false,
        },
      });
  } catch (criticalError) {
    console.error('❌ [i18n] Erro crítico ao inicializar fallback:', criticalError);
  }
}

export default i18n;
