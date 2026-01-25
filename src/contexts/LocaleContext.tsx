import React, { createContext, useContext, ReactNode, useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import lazyTranslations from '@/lib/lazyTranslations';
import languageAnalytics from '@/lib/languageAnalytics';
import { devLogOnce } from '@/utils/debug/devLogDedupe';

// ✅ CORREÇÃO: Tipo simplificado - apenas português
type SupportedLocale = 'pt';

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// ✅ CORREÇÃO: Fallback apenas em português
function getFallbackTranslations(): Record<string, any> {
  return {
    hero: {
      title: 'Crie uma Música Personalizada Profissional',
      subtitle: 'Surpreenda alguém especial com uma música única'
    },
    pricing: {
      whyChoose: 'Por que escolher o Music Lovely?'
    },
    quiz: {
      title: 'Questionário',
      button: {
        submit: 'Enviar',
        next: 'Próximo',
        back: 'Voltar'
      },
      validation: {
        selectRelationship: 'Selecione um relacionamento',
        enterRelationship: 'Digite o relacionamento',
        enterName: 'Nome é obrigatório',
        nameTooLong: 'Nome muito longo (máximo 100 caracteres)',
        selectStyle: 'Selecione um estilo musical',
        maxCharacters: 'Máximo 500 caracteres',
        maxMemories: 'Máximo 800 caracteres',
        maxMessage: 'Máximo 500 caracteres'
      }
    },
    features: {
      step1: { title: 'Preencha o Questionário' },
      step2: { title: 'Aprovamos a Letra' },
      step3: { title: 'Produzimos sua Música' }
    }
  };
}

// ✅ CORREÇÃO: Função helper para buscar texto de fallback por chave (sempre português)
function getFallbackText(key: string): string {
  const fallbacks = getFallbackTranslations();
  const keys = key.split('.');
  let value: any = fallbacks;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return '';
    }
  }
  
  return typeof value === 'string' ? value : '';
}

interface LocaleContextType {
  locale: SupportedLocale;
  isLoading: boolean;
  changeLocale: (newLocale: SupportedLocale) => void;
  error: string | null;
  redetect: () => void;
  t: (key: string, fallback?: string | Record<string, string | number>) => string;
  translations: Record<string, any>;
  forceLocale: (locale: SupportedLocale) => void;
  isLocaleForced: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'pt',
  isLoading: false,
  changeLocale: () => {},
  error: null,
  redetect: () => {},
  t: (key: string, _fallback?: string | Record<string, string | number>) => {
    // Usar fallback se fornecido, senão retornar a chave
    if (typeof _fallback === 'string') return _fallback;
    return key;
  },
  translations: {},
  forceLocale: () => {},
  isLocaleForced: false
});

// Stub simples - sempre retorna português (sem dependência de hooks)
export const useLocaleContext = () => {
  // Importar i18n diretamente para evitar dependência circular
  let i18n: any;
  try {
    i18n = require('@/i18n').default;
  } catch {
    i18n = null;
  }
  
  return {
    locale: 'pt' as SupportedLocale,
    isLoading: false,
    changeLocale: () => {},
    error: null,
    redetect: () => {},
    t: (key: string, fallback?: string | Record<string, string | number>) => {
      if (typeof fallback === 'string') return fallback;
      try {
        return i18n?.t(key) || key;
      } catch {
        return key;
      }
    },
    translations: {},
    forceLocale: (_locale: SupportedLocale) => {},
    isLocaleForced: false
  };
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  // ✅ CORREÇÃO: Rotas admin não precisam de traduções - verificar primeiro
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/app/admin');
  
  // ✅ CORREÇÃO: Sempre português, sem detecção
  const [locale] = useState<SupportedLocale>('pt');
  // ✅ OTIMIZAÇÃO MOBILE: Não bloquear renderização - sempre começar com fallback
  const [isLoading, setIsLoading] = useState(false); // Nunca bloquear renderização
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, any>>(() => {
    // ✅ OTIMIZAÇÃO MOBILE: Inicializar com fallback imediato
    try {
      if (isAdminRoute) return {};
      return getFallbackTranslations();
    } catch (e) {
      if (isDev) {
        console.warn('⚠️ [LocaleContext] Erro ao inicializar traduções, usando fallback pt:', e);
      }
      return getFallbackTranslations();
    }
  });
  const [isLocaleForced, setIsLocaleForced] = useState(false);

  // Log removido para reduzir verbosidade

  // ✅ OTIMIZAÇÃO MOBILE: Atualizar imediatamente quando a rota mudar para admin
  useEffect(() => {
    if (isAdminRoute) {
      setIsLoading(false);
      setTranslations({}); // Admin não precisa de traduções
    }
  }, [isAdminRoute]);

  // Carregar traduções com lazy loading e cache
  useEffect(() => {
    // ✅ CORREÇÃO: Pular carregamento de traduções para rotas admin
    if (isAdminRoute) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const loadTranslations = async () => {
      try {
        // ✅ OTIMIZAÇÃO MOBILE: Não setar isLoading=true para não bloquear renderização
        // Já temos fallback, então podemos carregar em background
        setError(null);
        if (isDev) {
          devLogOnce(`LocaleContext:loadTranslations:${locale}:${isLocaleForced}`, () => {
            console.log('🌍 [LocaleContext] Carregando traduções para:', locale);
            console.log('🌍 [LocaleContext] Idioma forçado:', isLocaleForced);
          });
        }
        
        // ✅ OTIMIZAÇÃO: Timeout fixo de 5s
        const timeoutMs = 5000;
        
        const loadPromise = lazyTranslations.load(locale);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Timeout ao carregar traduções')), timeoutMs);
        });

        const currentTranslations = await Promise.race([loadPromise, timeoutPromise]);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!isMounted) return;

        if (isDev) {
          const keys = Object.keys(currentTranslations);
          devLogOnce(`LocaleContext:translationsLoaded:${locale}:${keys.join(',')}`, () => {
            console.log('🌍 [LocaleContext] Traduções carregadas:', keys);
          });
        }
        setTranslations(currentTranslations);
        setIsLoading(false);

        // Registrar no analytics
        languageAnalytics.trackLanguageUsage(locale, isLocaleForced ? 'manual' : 'detection');
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!isMounted) return;

        if (isDev) {
          console.error('❌ [LocaleContext] Erro ao carregar traduções:', err);
        }
        setError(err instanceof Error ? err.message : 'Erro ao carregar traduções');
        
        // ✅ OTIMIZAÇÃO MOBILE: Fallback imediato - já temos traduções básicas carregadas
        try {
          if (isDev) {
            console.log('🔄 [LocaleContext] Usando fallback de traduções básicas...');
          }
          const fallbackTranslations = getFallbackTranslations();
          setTranslations(fallbackTranslations);
          setIsLoading(false);
        } catch (fallbackErr) {
          if (isDev) {
            console.error('❌ [LocaleContext] Erro no fallback:', fallbackErr);
          }
          // Garantir que pelo menos temos algo
          setTranslations(getFallbackTranslations());
          setIsLoading(false);
        }
      }
    };

    // ✅ CORREÇÃO: Remover condição que impede carregamento inicial
    loadTranslations();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [locale, isLocaleForced, isAdminRoute]); // ✅ CORREÇÃO CRÍTICA: Remover location.pathname para evitar loops

  // ✅ CORREÇÃO: Removida sincronização com URL - sempre português

  // ✅ OTIMIZAÇÃO: Função de tradução memoizada com fallbacks robustos e suporte a variáveis
  const t = useCallback((key: string, fallback?: string | Record<string, string | number>): string => {
    // Extrair variáveis se o segundo parâmetro for um objeto
    let variables: Record<string, string | number> | undefined;
    let fallbackText: string | undefined;
    
    if (typeof fallback === 'object' && fallback !== null) {
      variables = fallback;
      fallbackText = undefined;
    } else {
      fallbackText = typeof fallback === 'string' ? fallback : undefined;
    }

    try {

      // Verificar se as traduções estão carregadas
      if (!translations || Object.keys(translations).length === 0) {
        // Se não tem traduções, usar fallback ou buscar em traduções básicas
        const basicFallback = getFallbackText(key);
        let result = fallbackText || basicFallback || key;
        
        // Substituir variáveis mesmo no fallback
        if (variables) {
          Object.entries(variables).forEach(([varKey, varValue]) => {
            result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
          });
        }
        
        return result;
      }

      // Navegar pela estrutura aninhada das traduções
      const keys = key.split('.');
      let value: any = translations;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Se não encontrar, tentar fallback básico antes de retornar chave
          const basicFallback = getFallbackText(key);
          let result = fallbackText || basicFallback || key;
          
          // Substituir variáveis mesmo no fallback
          if (variables) {
            Object.entries(variables).forEach(([varKey, varValue]) => {
              result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
            });
          }
          
          return result;
        }
      }
      
      // ✅ CORREÇÃO: Garantir que sempre retorna string não vazia e sem espaços extras
      let result = typeof value === 'string' && value.trim() !== '' 
        ? value.trim() 
        : (fallbackText || getFallbackText(key) || key);
      
      // Substituir variáveis se fornecidas
      if (variables) {
        Object.entries(variables).forEach(([varKey, varValue]) => {
          result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
        });
      }
      
      return result;
    } catch (err) {
      if (isDev) {
        console.warn('⚠️ [LocaleContext] Erro na tradução da chave:', key, err);
      }
      const basicFallback = getFallbackText(key);
      let result = fallbackText || basicFallback || key;
      
      // Substituir variáveis mesmo em caso de erro
      if (variables) {
        Object.entries(variables).forEach(([varKey, varValue]) => {
          result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
        });
      }
      
      return result;
    }
  }, [translations]);


  // ✅ CORREÇÃO: Funções simplificadas - sempre português
  const forceLocale = useCallback((_newLocale: SupportedLocale) => {
    // Não faz nada - sempre português
    setIsLocaleForced(true);
    languageAnalytics.trackManualChange('pt');
  }, []);

  const changeLocale = useCallback((_newLocale: SupportedLocale) => {
    // Não faz nada - sempre português
    setIsLocaleForced(false);
  }, []);

  const redetect = useCallback(() => {
    // Não faz nada - sempre português
    setError(null);
  }, []);

  // ✅ OTIMIZAÇÃO: Memoizar o valor do contexto para evitar re-renders desnecessários
  const contextValue = useMemo(() => ({
    locale,
    isLoading,
    changeLocale,
    error,
    redetect,
    t,
    translations,
    forceLocale,
    isLocaleForced
  }), [locale, isLoading, changeLocale, error, redetect, t, translations, forceLocale, isLocaleForced]);

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};
