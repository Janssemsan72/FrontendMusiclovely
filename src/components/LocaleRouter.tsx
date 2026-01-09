import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLocaleContext } from '@/contexts/LocaleContext';
import { getCurrentLocale, removeLocalePrefix } from '@/lib/i18nRoutes';
import { getLocaleFromPath } from '@/lib/detectLocale';
import languageAnalytics from '@/lib/languageAnalytics';
import { detectLocaleAtEdge, normalizeSimpleLocale } from '@/lib/edgeLocale';
import { getDeviceInfo, getOptimizedTimeout } from '@/utils/detection/deviceDetection';
import PublicRoutes from './PublicRoutes';
import { devLog, i18nLog, isDevVerbose } from '@/utils/debug/devLogger';

const SUPPORTED_LOCALES = ['pt', 'en', 'es'] as const;

// Cache para resultado da detecção de edge (evitar múltiplas chamadas)
let cachedEdgeDetection: { locale: string | null; timestamp: number } | null = null;
const EDGE_DETECTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ✅ FASE 5: Singleton Global para Estado de Navegação
// Variáveis globais para persistir estado entre re-renders do componente
const globalNavigationState = {
  hasProcessed: new Map<string, number>(), // Map<routeKey, timestamp>
  isNavigating: false,
  isProcessing: false,
  lastNavigationTime: 0,
  navigationCount: 0,
  processingTimeout: null as NodeJS.Timeout | null,
  debounceTimeout: null as NodeJS.Timeout | null,
};

// Constantes para controle de cache e debounce
const ROUTE_PROCESSING_COOLDOWN_MS = 2000; // 2 segundos - Fase 4
const DEBOUNCE_DELAY_MS = 500; // 500ms - Fase 1
const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos - Fase 2
const MAX_CACHE_SIZE = 100; // Máximo de rotas no cache

// ✅ SOLUÇÃO ULTRA RADICAL: Wrapper que verifica locale ANTES de renderizar LocaleRouter
function LocaleRouterWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // ✅ CORREÇÃO: Redirecionar /pt/*, /en/*, /es/* para /* (remover prefixo)
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Se a rota começa com /pt/, /en/ ou /es/, redirecionar para a mesma rota sem o prefixo
    if (currentPath.startsWith('/pt/') || currentPath === '/pt' ||
        currentPath.startsWith('/en/') || currentPath === '/en' ||
        currentPath.startsWith('/es/') || currentPath === '/es') {
      const pathWithoutLocale = currentPath.replace(/^\/(pt|en|es)/, '') || '/';
      const newPath = `${pathWithoutLocale}${location.search}${location.hash}`;
      
      console.log('🔄 [LocaleRouter] Redirecionando rota com prefixo de idioma:', {
        from: currentPath,
        to: newPath
      });
      
      navigate(newPath, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);
  
  // Verificar se já tem locale válido ANTES de qualquer hook
  const currentPath = location.pathname;
  const localeFromPath = getCurrentLocale(currentPath);
  const hasValidLocale = !!(
    localeFromPath && 
    SUPPORTED_LOCALES.includes(localeFromPath as any)
  );
  
  // ✅ CORREÇÃO: Se tem locale válido (pt, en, es), NÃO renderizar PublicRoutes diretamente
  // O useEffect acima vai redirecionar primeiro
  // Se não tem locale válido, renderizar LocaleRouter para processar
  return <LocaleRouterInternal />;
}

function LocaleRouterInternal() {
  const { forceLocale } = useLocaleContext();
  const location = useLocation();
  
  if (isDevVerbose) {
    devLog.debug('[LocaleRouter] LocaleRouterInternal renderizando...', {
      pathname: location.pathname,
      timestamp: new Date().toISOString()
    });
  }
  const navigate = useNavigate();
  const params = useParams<{ locale?: string }>();
  const detectionAbortController = useRef<AbortController | null>(null);
  const forceLocaleRef = useRef(forceLocale);
  
  // ✅ CORREÇÃO CRÍTICA: Atualizar ref quando forceLocale mudar
  useEffect(() => {
    forceLocaleRef.current = forceLocale;
  }, [forceLocale]);
  
  // ✅ SOLUÇÃO ULTRA RADICAL: Calcular valores diretamente (não usar refs aqui)
  const currentPath = location.pathname;
  const localeFromPath = getCurrentLocale(currentPath);
  const hasValidLocale = !!(
    localeFromPath && 
    SUPPORTED_LOCALES.includes(localeFromPath as any)
  );
  
  // ✅ FASE 2: Cache Mais Robusto - Limpar apenas rotas antigas (> 5 minutos)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      // Limpar rotas antigas (> 5 minutos)
      for (const [routeKey, timestamp] of globalNavigationState.hasProcessed.entries()) {
        if (now - timestamp > CACHE_CLEANUP_INTERVAL_MS) {
          globalNavigationState.hasProcessed.delete(routeKey);
          cleaned++;
        }
      }
      
      // Se o cache ainda estiver muito grande, limpar as mais antigas
      if (globalNavigationState.hasProcessed.size > MAX_CACHE_SIZE) {
        const entries = Array.from(globalNavigationState.hasProcessed.entries())
          .sort((a, b) => a[1] - b[1]); // Ordenar por timestamp (mais antigas primeiro)
        
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
        toRemove.forEach(([routeKey]) => {
          globalNavigationState.hasProcessed.delete(routeKey);
          cleaned++;
        });
      }
      
      if (cleaned > 0) {
        i18nLog('Limpando cache de rotas processadas: ' + cleaned + ' rotas removidas');
      }
    }, 60000); // Verificar a cada 1 minuto
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // ✅ CORREÇÃO CRÍTICA: Ref para rastrear último routeKey processado (deve estar antes de processRoute)
  const lastProcessedRouteKeyRef = useRef<string | null>(null);
  const lastLocationStringRef = useRef<string>('');
  
  // ✅ FASE 1: useMemo para estabilizar routeKey e evitar recálculos
  // ✅ CORREÇÃO CRÍTICA: Usar string serializada para detectar mudanças reais
  const routeKey = useMemo(() => {
    const locationString = `${location.pathname}${location.search}${location.hash}`;
    // Se a string não mudou, retornar a anterior para evitar recálculos
    if (locationString === lastLocationStringRef.current) {
      return lastLocationStringRef.current;
    }
    lastLocationStringRef.current = locationString;
    return locationString;
  }, [location.pathname, location.search, location.hash]);

  // ✅ FASE 1: processRoute usando useCallback para estabilizar a função
  const processRoute = useCallback(() => {
    // ✅ CORREÇÃO CRÍTICA: Verificar hasValidLocale ANTES de qualquer processamento
    const currentPathCheck = location.pathname;
    const localeFromPathCheck = getCurrentLocale(currentPathCheck);
    const hasValidLocaleCheck = !!(
      localeFromPathCheck && 
      SUPPORTED_LOCALES.includes(localeFromPathCheck as any)
    );
    
    if (hasValidLocaleCheck) {
      // ✅ CORREÇÃO: Se tem locale válido na URL, redirecionar para remover prefixo
      const pathWithoutLocale = removeLocalePrefix(currentPathCheck);
      const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
      const search = location.search || '';
      const hash = location.hash || '';
      const finalPath = `${newPath}${search}${hash}`;
      
      // Atualizar contexto
      forceLocaleRef.current(localeFromPathCheck);
      
      // ✅ FASE 5: Marcar como navegando usando estado global
      globalNavigationState.isNavigating = true;
      globalNavigationState.lastNavigationTime = Date.now();
      
      globalNavigationState.hasProcessed.set(routeKey, Date.now());
      globalNavigationState.isProcessing = false;
      if (globalNavigationState.processingTimeout) {
        clearTimeout(globalNavigationState.processingTimeout);
        globalNavigationState.processingTimeout = null;
      }
      
      setTimeout(() => {
        navigate(finalPath, { replace: true });
        setTimeout(() => {
          globalNavigationState.isNavigating = false;
          lastProcessedRouteKeyRef.current = finalPath;
        }, 100);
      }, 0);
      
      return;
    }
    
    // ✅ FASE 4: Verificação dupla após debounce
    if (globalNavigationState.isProcessing || globalNavigationState.isNavigating) {
      return;
    }
    
    // ✅ FASE 4: Verificar novamente se rota foi processada recentemente
    const timestamp = globalNavigationState.hasProcessed.get(routeKey);
    if (timestamp && Date.now() - timestamp < ROUTE_PROCESSING_COOLDOWN_MS) {
      i18nLog('Rota processada recentemente (após debounce), pulando: ' + routeKey);
      return;
    }
    
    // ✅ FASE 5: Marcar como processando usando estado global
    globalNavigationState.isProcessing = true;
    
    // ✅ FASE 5: Timeout de segurança (5 segundos máximo)
    if (globalNavigationState.processingTimeout) {
      clearTimeout(globalNavigationState.processingTimeout);
    }
    globalNavigationState.processingTimeout = setTimeout(() => {
      devLog.warn('⚠️ [LocaleRouter] Timeout de processamento atingido, resetando flag');
      globalNavigationState.isProcessing = false;
      globalNavigationState.processingTimeout = null;
    }, 5000);
    
    const currentPath = location.pathname;
    const localeFromPath = getCurrentLocale(currentPath);

    // Validar se o locale na URL é suportado
    if (params.locale && !SUPPORTED_LOCALES.includes(params.locale as any)) {
      i18nLog('Locale inválido na URL: ' + params.locale);
      // ✅ FASE 2: Adicionar ao cache com timestamp
      globalNavigationState.hasProcessed.set(routeKey, Date.now());
      
      const pathWithoutLocale = removeLocalePrefix(currentPath);
      const search = location.search || '';
      const hash = location.hash || '';
      
      // ✅ FASE 5: Marcar como navegando usando estado global
      globalNavigationState.isNavigating = true;
      globalNavigationState.lastNavigationTime = Date.now();
      
      setTimeout(() => {
        navigate(`${pathWithoutLocale}${search}${hash}`, { replace: true });
        // ✅ CORREÇÃO CRÍTICA: Atualizar ref após navegação para bloquear o novo routeKey
        const newRouteKey = `${pathWithoutLocale}${search}${hash}`;
        setTimeout(() => {
          globalNavigationState.isNavigating = false;
          lastProcessedRouteKeyRef.current = newRouteKey;
        }, 100);
      }, 0);
      
      // Resetar flags
      globalNavigationState.isProcessing = false;
      if (globalNavigationState.processingTimeout) {
        clearTimeout(globalNavigationState.processingTimeout);
        globalNavigationState.processingTimeout = null;
      }
      return;
    }

    // ✅ CORREÇÃO: Se tem locale na URL, SEMPRE redirecionar para remover o prefixo
    // Nunca manter prefixo /pt, /en ou /es na URL
    if (localeFromPath && SUPPORTED_LOCALES.includes(localeFromPath as any)) {
      // ✅ FASE 2: Adicionar ao cache com timestamp
      globalNavigationState.hasProcessed.set(routeKey, Date.now());
      
      // ✅ CORREÇÃO CRÍTICA: Redirecionar para remover prefixo de locale
      const pathWithoutLocale = removeLocalePrefix(currentPath);
      const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
      const search = location.search || '';
      const hash = location.hash || '';
      const finalPath = `${newPath}${search}${hash}`;
      
      // Atualizar contexto com o locale detectado
      forceLocaleRef.current(localeFromPath);
      languageAnalytics.trackUrlAccess(localeFromPath, currentPath);
      
      // ✅ FASE 5: Marcar como navegando usando estado global
      globalNavigationState.isNavigating = true;
      globalNavigationState.lastNavigationTime = Date.now();
      
      // ✅ FASE 5: Resetar flags antes de navegar
      globalNavigationState.isProcessing = false;
      if (globalNavigationState.processingTimeout) {
        clearTimeout(globalNavigationState.processingTimeout);
        globalNavigationState.processingTimeout = null;
      }
      
      setTimeout(() => {
        navigate(finalPath, { replace: true });
        // ✅ CORREÇÃO CRÍTICA: Atualizar ref após navegação
        setTimeout(() => {
          globalNavigationState.isNavigating = false;
          lastProcessedRouteKeyRef.current = finalPath;
        }, 100);
      }, 0);
      
      return;
    }

    const detectAndRedirect = async () => {
      try {
        // Cancelar detecção anterior se houver
        if (detectionAbortController.current) {
          detectionAbortController.current.abort();
        }
        detectionAbortController.current = new AbortController();

        // 0) Preferência do usuário (cookie/localStorage) sempre vence
        const cookieLang = document.cookie.match(/(?:^|; )lang=([^;]+)/)?.[1] || null;
        const storedLang = localStorage.getItem('musiclovely_language');
        const preferred = normalizeSimpleLocale(cookieLang) || normalizeSimpleLocale(storedLang);

        if (preferred) {
          // ✅ FASE 2: Adicionar ao cache com timestamp
          globalNavigationState.hasProcessed.set(routeKey, Date.now());
          forceLocaleRef.current(preferred);
          languageAnalytics.trackUrlAccess(preferred, currentPath);
          
          // ✅ FASE 3: Se já está na URL correta, apenas retornar
          if (localeFromPath === preferred) {
            globalNavigationState.isProcessing = false;
            if (globalNavigationState.processingTimeout) {
              clearTimeout(globalNavigationState.processingTimeout);
              globalNavigationState.processingTimeout = null;
            }
            // ✅ CORREÇÃO CRÍTICA: Atualizar ref quando não há navegação
            lastProcessedRouteKeyRef.current = routeKey;
            return;
          }
          
          // Redirecionar para o idioma preferido
          // ✅ CORREÇÃO: Nunca adicionar prefixo /pt - sempre usar caminho sem prefixo
          const pathWithoutLocale = removeLocalePrefix(currentPath);
          const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
          const finalPath = `${newPath}${location.search || ''}${location.hash || ''}`;
          
          localStorage.setItem('musiclovely_language', preferred);
          document.cookie = `lang=${preferred};path=/;max-age=${60*60*24*365};samesite=lax`;
          
          // ✅ FASE 5: Marcar como navegando usando estado global
          globalNavigationState.isNavigating = true;
          globalNavigationState.lastNavigationTime = Date.now();
          
          setTimeout(() => {
            navigate(finalPath, { replace: true });
            // ✅ CORREÇÃO CRÍTICA: Atualizar ref após navegação
            setTimeout(() => {
              globalNavigationState.isNavigating = false;
              lastProcessedRouteKeyRef.current = finalPath;
            }, 100);
          }, 0);
          return;
        }

        // 2) Edge detection (rápido e privado) com timeout otimizado
        let edgeLang: string | null = null;
        
        // Verificar cache primeiro
        if (cachedEdgeDetection && Date.now() - cachedEdgeDetection.timestamp < EDGE_DETECTION_CACHE_TTL) {
          edgeLang = cachedEdgeDetection.locale;
          i18nLog('Usando detecção de edge do cache: ' + edgeLang);
        } else {
          try {
            // ✅ CORREÇÃO LOADING INFINITO: Timeout máximo de 2 segundos (reduzido de 3s)
            // Isso garante que nunca trava por mais de 2s
            const timeoutMs = 2000;
            
            // ✅ CORREÇÃO LOADING INFINITO: Garantir que detectLocaleAtEdge sempre retorna
            // Usar Promise.race com timeout para garantir que nunca trava
            const edgePromise = detectLocaleAtEdge(detectionAbortController.current.signal);
            const timeoutPromise = new Promise<null>((resolve) => {
              setTimeout(() => {
                devLog.warn('[LocaleRouter] ⚠️ Timeout na detecção de edge (2s), usando fallback');
                // Abortar detecção se ainda estiver rodando
                if (detectionAbortController.current && !detectionAbortController.current.signal.aborted) {
                  detectionAbortController.current.abort();
                }
                resolve(null);
              }, timeoutMs);
            });

            // ✅ CORREÇÃO LOADING INFINITO: Promise.race garante que sempre retorna em 2s
            const edge = await Promise.race([
              edgePromise.catch((err) => {
                // ✅ CORREÇÃO LOADING INFINITO: Capturar qualquer erro e retornar null
                if (!detectionAbortController.current.signal.aborted) {
                  devLog.error('[LocaleRouter] Erro na detecção de edge:', err);
                }
                return null;
              }),
              timeoutPromise
            ]);
            
            if (edge && !detectionAbortController.current.signal.aborted) {
              edgeLang = normalizeSimpleLocale(edge.language);
              // Cachear resultado
              cachedEdgeDetection = {
                locale: edgeLang,
                timestamp: Date.now()
              };
            }
          } catch (err) {
            // ✅ CORREÇÃO LOADING INFINITO: Garantir que erro nunca trava o fluxo
            if (!detectionAbortController.current.signal.aborted) {
              devLog.error('[LocaleRouter] Erro crítico na detecção de edge:', err);
            }
            // Continuar com fallback (navegador)
            edgeLang = null;
          }
        }

        // 3) Fallback: navegador (sempre disponível, não bloqueia)
        const navLang = normalizeSimpleLocale(navigator.language) || normalizeSimpleLocale((navigator.languages || [])[0]);

        const final = edgeLang || navLang || 'pt';

        // ✅ FASE 2: Marcar como processado antes de redirecionar
        globalNavigationState.hasProcessed.set(routeKey, Date.now());
        
        // ✅ FASE 3: Se já está correto, só fixa contexto e grava preferências
        if (localeFromPath === final) {
          forceLocaleRef.current(final);
          languageAnalytics.trackUrlAccess(final, currentPath);
          localStorage.setItem('musiclovely_language', final);
          document.cookie = `lang=${final};path=/;max-age=${60*60*24*365};samesite=lax`;
          
          globalNavigationState.isProcessing = false;
          if (globalNavigationState.processingTimeout) {
            clearTimeout(globalNavigationState.processingTimeout);
            globalNavigationState.processingTimeout = null;
          }
          // ✅ CORREÇÃO CRÍTICA: Atualizar ref quando não há navegação
          lastProcessedRouteKeyRef.current = routeKey;
          return;
        }
        
        // Redirecionar para o idioma decidido
        // ✅ CORREÇÃO: Nunca adicionar prefixo /pt - sempre usar caminho sem prefixo
        const pathWithoutLocale = removeLocalePrefix(currentPath);
        const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
        const search = location.search || '';
        const hash = location.hash || '';
        const finalPath = `${newPath}${search}${hash}`;

        localStorage.setItem('musiclovely_language', final);
        document.cookie = `lang=${final};path=/;max-age=${60*60*24*365};samesite=lax`;

        // ✅ FASE 5: Marcar como navegando usando estado global
        globalNavigationState.isNavigating = true;
        globalNavigationState.lastNavigationTime = Date.now();
        
        setTimeout(() => {
          navigate(finalPath, { replace: true });
          // ✅ CORREÇÃO CRÍTICA: Atualizar ref após navegação
          setTimeout(() => {
            globalNavigationState.isNavigating = false;
            lastProcessedRouteKeyRef.current = finalPath;
          }, 100);
        }, 0);
      } catch (error) {
        // ✅ CORREÇÃO LOADING INFINITO: Garantir reset em caso de erro usando estado global
        // ✅ CORREÇÃO LOADING INFINITO: NÃO fazer throw - sempre garantir que flags são resetadas
        devLog.error('[LocaleRouter] ❌ Erro em detectAndRedirect:', error);
        globalNavigationState.isProcessing = false;
        if (globalNavigationState.processingTimeout) {
          clearTimeout(globalNavigationState.processingTimeout);
          globalNavigationState.processingTimeout = null;
        }
        // ✅ CORREÇÃO LOADING INFINITO: Não fazer throw - usar fallback de navegador
        // Se chegou aqui, usar fallback padrão (pt) e continuar
        const fallbackLang = normalizeSimpleLocale(navigator.language) || 'pt';
        forceLocaleRef.current(fallbackLang);
        lastProcessedRouteKeyRef.current = routeKey;
        globalNavigationState.hasProcessed.set(routeKey, Date.now());
      }
    };

    // ✅ CORREÇÃO CRÍTICA: Se tem locale válido na URL, redirecionar para remover prefixo
    if (hasValidLocale) {
      const pathWithoutLocale = removeLocalePrefix(location.pathname);
      const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
      const search = location.search || '';
      const hash = location.hash || '';
      const finalPath = `${newPath}${search}${hash}`;
      
      // Atualizar contexto
      forceLocaleRef.current(localeFromPath);
      
      // ✅ FASE 5: Marcar como navegando usando estado global
      globalNavigationState.isNavigating = true;
      globalNavigationState.lastNavigationTime = Date.now();
      
      globalNavigationState.hasProcessed.set(routeKey, Date.now());
      globalNavigationState.isProcessing = false;
      if (globalNavigationState.processingTimeout) {
        clearTimeout(globalNavigationState.processingTimeout);
        globalNavigationState.processingTimeout = null;
      }
      
      setTimeout(() => {
        navigate(finalPath, { replace: true });
        setTimeout(() => {
          globalNavigationState.isNavigating = false;
          lastProcessedRouteKeyRef.current = finalPath;
        }, 100);
      }, 0);
      
      return;
    }
    
    // ✅ CORREÇÃO LOADING INFINITO: Executar em background e garantir que sempre finaliza
    detectAndRedirect()
      .catch((err) => {
        // ✅ CORREÇÃO LOADING INFINITO: Capturar qualquer erro não tratado
        devLog.error('[LocaleRouter] Erro não tratado em detectAndRedirect:', err);
        // Usar fallback padrão
        const fallbackLang = normalizeSimpleLocale(navigator.language) || 'pt';
        forceLocaleRef.current(fallbackLang);
        lastProcessedRouteKeyRef.current = routeKey;
        globalNavigationState.hasProcessed.set(routeKey, Date.now());
      })
      .finally(() => {
        // ✅ CORREÇÃO LOADING INFINITO: Resetar flag após processamento completo usando estado global
        globalNavigationState.isProcessing = false;
        if (globalNavigationState.processingTimeout) {
          clearTimeout(globalNavigationState.processingTimeout);
          globalNavigationState.processingTimeout = null;
        }
      });
  }, [routeKey, hasValidLocale, localeFromPath]); // ✅ FASE 1: routeKey, hasValidLocale e localeFromPath como dependências

  // ✅ SOLUÇÃO RADICAL: Este useEffect SÓ executa se NÃO tem locale válido na URL
  // Se hasValidLocale for true, este useEffect nunca será executado porque o componente já retornou acima
  useEffect(() => {
    
    // ✅ CORREÇÃO CRÍTICA: Se já tem locale válido, NÃO PROCESSAR NADA
    if (hasValidLocale) {
      return;
    }
    
    // ⚠️ CRÍTICO: Se a URL atual é da Cakto (domínio externo), não processar nada
    if (window.location.hostname === 'pay.cakto.com.br') {
      return;
    }
    
    // ✅ CORREÇÃO CRÍTICA: Se o routeKey não mudou desde a última execução, não processar
    if (lastProcessedRouteKeyRef.current === routeKey) {
      return;
    }
    
    // ✅ CORREÇÃO CRÍTICA: Se já está processando ou navegando, bloquear completamente
    if (globalNavigationState.isProcessing || globalNavigationState.isNavigating) {
      return;
    }
    
    // ✅ FASE 4: Verificação Prévia Mais Rigorosa - Bloquear completamente se qualquer condição for verdadeira
    const now = Date.now();
    const timeSinceLastNav = now - globalNavigationState.lastNavigationTime;
    
    // Verificar se rota foi processada recentemente (< 2 segundos)
    const timestamp = globalNavigationState.hasProcessed.get(routeKey);
    if (timestamp && Date.now() - timestamp < ROUTE_PROCESSING_COOLDOWN_MS) {
      lastProcessedRouteKeyRef.current = routeKey;
      return;
    }
    
    // Verificar se houve muitas navegações recentes (possível loop)
    if (timeSinceLastNav < 1000 && timeSinceLastNav > 0) {
      globalNavigationState.navigationCount++;
      if (globalNavigationState.navigationCount > 3) {
        devLog.error('❌ [LocaleRouter] LOOP DETECTADO! Bloqueando:', routeKey);
        lastProcessedRouteKeyRef.current = routeKey;
        globalNavigationState.hasProcessed.set(routeKey, Date.now() + 10000); // Bloquear por 10 segundos
        return;
      }
    } else {
      globalNavigationState.navigationCount = 0;
    }
    
    // ✅ FASE 1: Debounce Agressivo - Limpar debounce anterior se existir
    if (globalNavigationState.debounceTimeout) {
      clearTimeout(globalNavigationState.debounceTimeout);
      globalNavigationState.debounceTimeout = null;
    }
    
    // ✅ FASE 1: Aplicar debounce de 500ms antes de processar
    globalNavigationState.debounceTimeout = setTimeout(() => {
      globalNavigationState.debounceTimeout = null;
      
      // ✅ CORREÇÃO CRÍTICA: Verificações finais antes de processar
      if (lastProcessedRouteKeyRef.current === routeKey) {
        return;
      }
      if (globalNavigationState.isProcessing || globalNavigationState.isNavigating) {
        return;
      }
      
      // ✅ CORREÇÃO CRÍTICA: Verificar novamente se locale já está correto ANTES de processar
      const currentPathCheck = location.pathname;
      const localeFromPathCheck = getCurrentLocale(currentPathCheck);
      const hasValidLocaleCheck = !!(
        localeFromPathCheck && 
        SUPPORTED_LOCALES.includes(localeFromPathCheck as any)
      );
      
      if (hasValidLocaleCheck) {
        // ✅ CORREÇÃO: Se tem locale válido na URL, redirecionar para remover prefixo
        const pathWithoutLocale = removeLocalePrefix(currentPathCheck);
        const newPath = pathWithoutLocale === '/' ? '/' : pathWithoutLocale;
        const search = location.search || '';
        const hash = location.hash || '';
        const finalPath = `${newPath}${search}${hash}`;
        
        // Atualizar contexto
        forceLocaleRef.current(localeFromPathCheck);
        
        // ✅ FASE 5: Marcar como navegando usando estado global
        globalNavigationState.isNavigating = true;
        globalNavigationState.lastNavigationTime = Date.now();
        
        globalNavigationState.hasProcessed.set(routeKey, Date.now());
        globalNavigationState.isProcessing = false;
        if (globalNavigationState.processingTimeout) {
          clearTimeout(globalNavigationState.processingTimeout);
          globalNavigationState.processingTimeout = null;
        }
        
        setTimeout(() => {
          navigate(finalPath, { replace: true });
          setTimeout(() => {
            globalNavigationState.isNavigating = false;
            lastProcessedRouteKeyRef.current = finalPath;
          }, 100);
        }, 0);
        
        return;
      }
      
      processRoute();
    }, DEBOUNCE_DELAY_MS);
    
    // Cleanup: limpar debounce se componente desmontar ou dependências mudarem
    return () => {
      if (globalNavigationState.debounceTimeout) {
        clearTimeout(globalNavigationState.debounceTimeout);
        globalNavigationState.debounceTimeout = null;
      }
    };
    // ✅ FASE 1: Apenas routeKey como dependência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, hasValidLocale]);
  
  // Cleanup: cancelar detecção se componente desmontar
  useEffect(() => {
    return () => {
      if (detectionAbortController.current) {
        detectionAbortController.current.abort();
      }
      // ✅ FASE 5: Limpar timeouts no cleanup usando estado global
      if (globalNavigationState.processingTimeout) {
        clearTimeout(globalNavigationState.processingTimeout);
        globalNavigationState.processingTimeout = null;
      }
      if (globalNavigationState.debounceTimeout) {
        clearTimeout(globalNavigationState.debounceTimeout);
        globalNavigationState.debounceTimeout = null;
      }
      globalNavigationState.isProcessing = false;
    };
  }, []);

  // ✅ SOLUÇÃO RADICAL: Este useEffect foi removido porque se hasValidLocale for true,
  // o componente já retornou PublicRoutes acima (linha 70), então nenhum useEffect adicional será executado.
  // Isso previne completamente qualquer loop de navegação quando já tem locale válido.

  // ✅ OTIMIZAÇÃO MOBILE: Sempre renderizar PublicRoutes imediatamente
  // Não bloquear renderização enquanto processa detecção de idioma
  return <PublicRoutes />;
}

// Exportar o wrapper em vez do componente interno
export default LocaleRouterWrapper;
