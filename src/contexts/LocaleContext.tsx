import React, { createContext, useContext, ReactNode, useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import lazyTranslations from '@/lib/lazyTranslations';
import languageAnalytics from '@/lib/languageAnalytics';
import { detectLanguage, type SupportedLocale } from '@/lib/language-detection';
import { getOptimizedTimeout, getDeviceInfo } from '@/utils/detection/deviceDetection';
import { devLogOnce } from '@/utils/debug/devLogDedupe';

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// ✅ CORREÇÃO: Função helper para traduções de fallback
function getFallbackTranslations(locale: SupportedLocale): Record<string, any> {
  const fallbacks: Record<string, Record<string, any>> = {
    pt: {
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
    },
    en: {
      hero: {
        title: 'Create a Professional Personalized Song',
        subtitle: 'Surprise someone special with a unique song'
      },
      pricing: {
        whyChoose: 'Why choose Music Lovely?'
      },
      quiz: {
        title: 'Quiz',
        button: {
          submit: 'Submit',
          next: 'Next',
          back: 'Back'
        }
      },
      features: {
        step1: { title: 'Fill Out the Quiz' },
        step2: { title: 'Approve the Lyrics' },
        step3: { title: 'We Produce Your Song' }
      }
    },
    es: {
      hero: {
        title: 'Crea una Canción Personalizada Profesional',
        subtitle: 'Sorprende a alguien especial con una canción única'
      },
      pricing: {
        whyChoose: '¿Por qué elegir Music Lovely?'
      },
      quiz: {
        title: 'Cuestionario',
        button: {
          submit: 'Enviar',
          next: 'Siguiente',
          back: 'Atrás'
        }
      },
      features: {
        step1: { title: 'Completa el Cuestionario' },
        step2: { title: 'Aprobamos la Letra' },
        step3: { title: 'Producimos tu Canción' }
      }
    }
  };

  return fallbacks[locale] || fallbacks.pt;
}

// ✅ CORREÇÃO: Função helper para buscar texto de fallback por chave
function getFallbackText(key: string, locale: SupportedLocale): string {
  const fallbacks = getFallbackTranslations(locale);
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
export const useLocaleContext = (): LocaleContextType => {
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
    changeLocale: (_newLocale: SupportedLocale) => {},
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
    forceLocale: (_newLocale: SupportedLocale) => {},
    isLocaleForced: false
  };
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  // ✅ CORREÇÃO: Rotas admin não precisam de traduções - verificar primeiro
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/app/admin');
  
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    try {
      return detectLanguage(typeof window !== 'undefined' ? window.location.pathname : '/');
    } catch (e) {
      if (isDev) {
        console.warn('⚠️ [LocaleContext] Erro ao detectar idioma inicial, usando pt:', e);
      }
      return 'pt';
    }
  });
  // ✅ OTIMIZAÇÃO MOBILE: Não bloquear renderização - sempre começar com fallback
  const [isLoading, setIsLoading] = useState(false); // Nunca bloquear renderização
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, any>>(() => {
    // ✅ OTIMIZAÇÃO MOBILE: Inicializar com fallback imediato
    try {
      if (isAdminRoute) return {};
      return getFallbackTranslations(locale);
    } catch (e) {
      if (isDev) {
        console.warn('⚠️ [LocaleContext] Erro ao inicializar traduções, usando fallback pt:', e);
      }
      return getFallbackTranslations('pt');
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
        
        // ✅ OTIMIZAÇÃO MOBILE: Timeout otimizado baseado no dispositivo (5s mobile, 10s desktop)
        let deviceInfo;
        try {
          deviceInfo = getDeviceInfo();
        } catch (e) {
          if (isDev) {
            console.warn('⚠️ [LocaleContext] Erro ao obter device info, usando defaults');
          }
          deviceInfo = { isMobile: false, isSlowConnection: false };
        }
        const timeoutMs = deviceInfo.isMobile || deviceInfo.isSlowConnection ? 5000 : 10000;
        
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
          const fallbackTranslations = getFallbackTranslations(locale);
          setTranslations(fallbackTranslations);
          setIsLoading(false);
        } catch (fallbackErr) {
          if (isDev) {
            console.error('❌ [LocaleContext] Erro no fallback:', fallbackErr);
          }
          // Garantir que pelo menos temos algo
          setTranslations(getFallbackTranslations('pt'));
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

  // ✅ CORREÇÃO: Sincronizar automaticamente o locale com o prefixo de URL
  // Isso garante que quando o usuário acessa /checkout, o locale seja atualizado corretamente
  useEffect(() => {
    // Detectar locale da URL atual
    const detected = detectLanguage(location.pathname);
    
    // Se o locale detectado da URL é diferente do atual, atualizar
    // Isso garante que o locale sempre corresponde à URL, mesmo se foi forçado anteriormente
    if (detected !== locale) {
      if (isDev) {
        console.log('🌍 [LocaleContext] Sincronizando locale com URL:', { 
          detected, 
          current: locale, 
          pathname: location.pathname, 
          isLocaleForced,
          willUpdate: true
        });
      }
      // Se estava forçado mas a URL mudou, resetar o flag de forçado
      // Isso permite que o locale seja sincronizado com a URL
      if (isLocaleForced) {
        setIsLocaleForced(false);
      }
      setLocale(detected);
    } else if (isDev && detected === locale) {
      // Log apenas para debug - locale já está correto
      devLogOnce(`LocaleContext:localeSynced:${locale}:${location.pathname}`, () => {
        console.log('🌍 [LocaleContext] Locale já está sincronizado:', { 
          locale, 
          pathname: location.pathname 
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
        const basicFallback = getFallbackText(key, locale);
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
          const basicFallback = getFallbackText(key, locale);
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
        : (fallbackText || getFallbackText(key, locale) || key);
      
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
      const basicFallback = getFallbackText(key, locale);
      let result = fallbackText || basicFallback || key;
      
      // Substituir variáveis mesmo em caso de erro
      if (variables) {
        Object.entries(variables).forEach(([varKey, varValue]) => {
          result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
        });
      }
      
      return result;
    }
  }, [translations, locale]);


  // ✅ OTIMIZAÇÃO: Funções memoizadas para evitar recriação desnecessária
  const forceLocale = useCallback((newLocale: SupportedLocale) => {
    if (isDev) {
      console.log('🌍 [LocaleContext] Forçando idioma para:', newLocale);
    }
    setIsLocaleForced(true);
    setLocale(newLocale);
    
    // Registrar no analytics
    languageAnalytics.trackManualChange(newLocale);
  }, []);

  const changeLocale = useCallback((newLocale: SupportedLocale) => {
    setIsLocaleForced(false);
    setLocale(newLocale);
  }, []);

  const redetect = useCallback(() => {
    try {
      setIsLoading(true);
      const detected = detectLanguage(typeof window !== 'undefined' ? window.location.pathname : '/');
      setLocale(detected);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erro na redetecção');
    } finally {
      setIsLoading(false);
    }
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
