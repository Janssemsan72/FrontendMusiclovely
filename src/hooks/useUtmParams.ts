import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import * as React from 'react';

const isDev = import.meta.env.DEV;

/**
 * Hook para capturar, salvar e preservar parâmetros UTM através do funil
 * Mantém UTMs em localStorage e injeta em todas as navegações
 */
export function useUtmParams() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Verificar se está em rota administrativa - não capturar nem preservar UTMs
  const isAdminRoute = location.pathname.startsWith('/admin') || 
                       location.pathname.startsWith('/app/admin');

  // Parâmetros de tracking completos (UTMs + Google Ads + Facebook + outros)
  const TRACKING_PARAMS = [
    // UTMs padrão
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    // Google Ads
    'gclid', 'gclsrc', 'gad_source', 'gad_campaignid', 'gbraid',
    // Google Analytics
    '_ga', '_gid',
    // Facebook
    'fbclid', 'fb_action_ids', 'fb_action_types',
    // Microsoft/Bing
    'msclkid',
    // Google Ads HSA (Historical Search Ads)
    'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
    // Outros parâmetros de tracking
    'ref', 'source', 'sck', 'xcod', 'network',
    // Google Analytics Campaign
    '_gac',
  ];

  // Capturar TODOS os parâmetros de tracking da URL atual
  const currentTrackingParams = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    const params: Record<string, string> = {};
    TRACKING_PARAMS.forEach(param => {
      const value = searchParams.get(param);
      if (value) {
        params[param] = value;
      }
    });
    
    // Também capturar parâmetros _gac_* (Google Analytics Campaign com formato _gac_GA_MEASUREMENT_ID__CAMPAIGN_ID__TIMESTAMP)
    searchParams.forEach((value, key) => {
      if (key.startsWith('_gac_') && !params[key]) {
        params[key] = value;
      }
    });
    
    return params;
  }, [isAdminRoute, searchParams]);

  // UTMs padrão (para compatibilidade)
  const currentUtms = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    const utms: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (currentTrackingParams[param]) {
        utms[param] = currentTrackingParams[param];
      }
    });
    return utms;
  }, [isAdminRoute, currentTrackingParams]);

  // ✅ OTIMIZAÇÃO FASE 1.2: Deferir leitura de localStorage usando useState
  const [savedTrackingParamsState, setSavedTrackingParamsState] = useState<Record<string, string>>({});
  const [isLocalStorageLoaded, setIsLocalStorageLoaded] = useState(false);

  // Carregar parâmetros de tracking salvos do localStorage (deferido)
  useEffect(() => {
    if (isAdminRoute) {
      setIsLocalStorageLoaded(true);
      return;
    }

    let cancelled = false;
    const loadFromStorage = () => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem('musiclovely_tracking_params');
        if (saved) {
          setSavedTrackingParamsState(JSON.parse(saved));
        }
      } catch {
        // Ignorar erros
      } finally {
        setIsLocalStorageLoaded(true);
      }
    };

    // Deferir leitura de localStorage usando requestIdleCallback
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const w = window as any;
      const id = w.requestIdleCallback(loadFromStorage, { timeout: 1000 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = setTimeout(loadFromStorage, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAdminRoute]);

  // Usar savedTrackingParamsState após carregar
  const savedTrackingParams = isLocalStorageLoaded ? savedTrackingParamsState : {};

  // ✅ OTIMIZAÇÃO FASE 1.2: Deferir escrita em localStorage usando requestIdleCallback
  useEffect(() => {
    if (isAdminRoute || !isLocalStorageLoaded) {
      return;
    }
    if (Object.keys(currentTrackingParams).length > 0) {
      let cancelled = false;
      const saveToStorage = () => {
        if (cancelled) return;
        try {
          localStorage.setItem('musiclovely_tracking_params', JSON.stringify(currentTrackingParams));
          setSavedTrackingParamsState(currentTrackingParams);
          if (isDev) {
            console.log('✅ Parâmetros de tracking salvos:', currentTrackingParams);
          }
        } catch {
          // Ignorar erros
        }
      };

      // Deferir escrita usando requestIdleCallback
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const w = window as any;
        const id = w.requestIdleCallback(saveToStorage, { timeout: 2000 });
        return () => {
          cancelled = true;
          if (typeof w.cancelIdleCallback === 'function') {
            w.cancelIdleCallback(id);
          }
        };
      }

      const timer = setTimeout(saveToStorage, 2000);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [isAdminRoute, currentTrackingParams, isLocalStorageLoaded]);

  // Parâmetros de tracking finais: mesclar URL atual + localStorage (URL atual tem prioridade)
  const allTrackingParams = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    // Sempre mesclar: parâmetros da URL atual + parâmetros salvos
    const merged = { ...savedTrackingParams, ...currentTrackingParams };
    return merged;
  }, [isAdminRoute, currentTrackingParams, savedTrackingParams]);

  // UTMs padrão (para compatibilidade com código existente)
  const utms = useMemo(() => {
    if (isAdminRoute) {
      return {};
    }
    const utms: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      if (allTrackingParams[param]) {
        utms[param] = allTrackingParams[param];
      }
    });
    return utms;
  }, [isAdminRoute, allTrackingParams]);

  // ✅ OTIMIZAÇÃO FASE 1.2: Deferir escrita de parâmetros mesclados
  useEffect(() => {
    if (isAdminRoute || !isLocalStorageLoaded) {
      return;
    }
    if (Object.keys(allTrackingParams).length > 0) {
      let cancelled = false;
      const saveMergedToStorage = () => {
        if (cancelled) return;
        try {
          localStorage.setItem('musiclovely_tracking_params', JSON.stringify(allTrackingParams));
          setSavedTrackingParamsState(allTrackingParams);
          if (isDev) {
            console.log('✅ Parâmetros de tracking mesclados e salvos:', allTrackingParams);
          }
        } catch {
          // Ignorar erros
        }
      };

      // Deferir escrita usando requestIdleCallback
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const w = window as any;
        const id = w.requestIdleCallback(saveMergedToStorage, { timeout: 2000 });
        return () => {
          cancelled = true;
          if (typeof w.cancelIdleCallback === 'function') {
            w.cancelIdleCallback(id);
          }
        };
      }

      const timer = setTimeout(saveMergedToStorage, 2000);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [isAdminRoute, allTrackingParams, isLocalStorageLoaded]);

  // ✅ DESABILITADO: Injeção de UTMs na URL removida para evitar conflito com script UTMify
  // O script UTMify (https://cdn.utmify.com.br/scripts/utms/latest.js) já gerencia os UTMs automaticamente
  // Manter apenas a leitura e salvamento no localStorage para uso interno do React
  // useEffect(() => {
  //   if (Object.keys(savedTrackingParams).length > 0 && Object.keys(currentTrackingParams).length === 0) {
  //     const currentParams = new URLSearchParams(location.search);
  //     let needsUpdate = false;
  //     Object.entries(savedTrackingParams).forEach(([key, value]) => {
  //       if (value && !currentParams.has(key)) {
  //         needsUpdate = true;
  //         currentParams.set(key, value as string);
  //       }
  //     });
  //     if (needsUpdate) {
  //       const newSearch = currentParams.toString();
  //       const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '') + (location.hash || '');
  //       window.history.replaceState({}, '', newUrl);
  //     }
  //   }
  // }, [location.pathname, location.search, savedTrackingParams, currentTrackingParams]);

  // ✅ CORREÇÃO PRODUÇÃO: Ref para prevenir navegação duplicada
  const navigationInProgressRef = React.useRef(false);
  
  /**
   * Função helper para navegar preservando TODOS os parâmetros de tracking
   * ✅ OTIMIZAÇÃO: Redirecionamento ULTRA-RÁPIDO usando window.location.href para /checkout
   */
  const navigateWithUtms = (path: string, options?: { replace?: boolean; state?: unknown }) => {
    // ✅ CORREÇÃO PRODUÇÃO: Prevenir navegação duplicada
    if (navigationInProgressRef.current) {
      if (isDev) {
        console.warn('⚠️ [navigateWithUtms] Navegação já em progresso, ignorando:', path);
      }
      return;
    }
    
    navigationInProgressRef.current = true;
    
    // ✅ Resetar flag após um tempo (fallback de segurança)
    setTimeout(() => {
      navigationInProgressRef.current = false;
    }, 1000);
    
    if (isAdminRoute) {
      navigate(path, options);
      navigationInProgressRef.current = false;
      return;
    }
    
    // ✅ OTIMIZAÇÃO CRÍTICA: Para /checkout, usar window.location.href (bypass React Router = mais rápido)
    if (path.includes('/checkout') || path === '/checkout') {
      const hasTrackingParams = Object.keys(allTrackingParams).length > 0;
      let finalUrl = path;
      
      if (hasTrackingParams) {
        const url = new URL(path, window.location.origin);
        const existingParams = new URLSearchParams(url.search);
        Object.entries(allTrackingParams).forEach(([key, value]) => {
          if (value) {
            existingParams.set(key, value as string);
          }
        });
        const hash = url.hash || '';
        finalUrl = url.pathname + (existingParams.toString() ? `?${existingParams.toString()}` : '') + hash;
      }
      
      // ✅ REDIRECIONAMENTO IMEDIATO: window.location.href é mais rápido que React Router
      window.location.href = finalUrl;
      return; // Não resetar flag aqui pois a página vai recarregar
    }
    
    // ✅ OTIMIZAÇÃO: Se não há parâmetros de tracking, navegar diretamente (mais rápido)
    const hasTrackingParams = Object.keys(allTrackingParams).length > 0;
    if (!hasTrackingParams) {
      navigate(path, options);
      navigationInProgressRef.current = false;
      return;
    }
    
    const url = new URL(path, window.location.origin);
    
    // Preservar parâmetros existentes na URL
    const existingParams = new URLSearchParams(url.search);
    
    // Adicionar/substituir TODOS os parâmetros de tracking na URL
    Object.entries(allTrackingParams).forEach(([key, value]) => {
      if (value) {
        existingParams.set(key, value as string);
      }
    });

    // ✅ CORREÇÃO: Ordem correta: pathname → ?search params (UTMs) → #hash
    // Preservar hash se existir no path original
    const hash = url.hash || '';
    const finalPath = url.pathname + (existingParams.toString() ? `?${existingParams.toString()}` : '') + hash;
    
    // ✅ OTIMIZAÇÃO: Remover log em produção para melhor performance
    if (isDev) {
      console.log('🔄 Navegando com parâmetros de tracking:', { path, finalPath, trackingParams: allTrackingParams });
    }
    
    // ✅ CORREÇÃO PRODUÇÃO: Navegar diretamente sem setTimeout que causa duplicação
    navigate(finalPath, options);
    navigationInProgressRef.current = false;
  };

  /**
   * Função para obter query string com TODOS os parâmetros de tracking
   */
  const getUtmQueryString = (includeExisting = true): string => {
    // Se não há parâmetros de tracking, retornar string vazia
    if (isAdminRoute || Object.keys(allTrackingParams).length === 0) {
      return '';
    }
    
    const params = new URLSearchParams();
    
    if (includeExisting) {
      // Incluir parâmetros existentes na URL atual
      searchParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
    
    // Adicionar TODOS os parâmetros de tracking salvos (se não já estiverem presentes)
    Object.entries(allTrackingParams).forEach(([key, value]) => {
      if (value && !params.has(key)) {
        params.set(key, value as string);
      }
    });

    const queryString = params.toString();
    
    if (!queryString) {
      return '';
    }
    
    // Se includeExisting é false e já temos params na URL atual, usar & ao invés de ?
    if (!includeExisting && searchParams.toString()) {
      // Retornar apenas os parâmetros novos com &
      const newParams = new URLSearchParams();
      Object.entries(allTrackingParams).forEach(([key, value]) => {
        if (value && !searchParams.has(key)) {
          newParams.set(key, value as string);
        }
      });
      const newParamsString = newParams.toString();
      return newParamsString ? `&${newParamsString}` : '';
    }
    
    return `?${queryString}`;
  };

  /**
   * Limpar parâmetros de tracking salvos (útil para testes ou reset)
   */
  const clearUtms = () => {
    if (isAdminRoute) {
      return;
    }
    localStorage.removeItem('musiclovely_tracking_params');
    localStorage.removeItem('musiclovely_utms'); // Manter compatibilidade
  };

  return {
    utms, // UTMs padrão (para compatibilidade)
    allTrackingParams, // TODOS os parâmetros de tracking
    currentUtms, // UTMs da URL atual (para compatibilidade)
    currentTrackingParams, // Todos os parâmetros da URL atual
    savedUtms: utms, // Para compatibilidade
    savedTrackingParams, // Todos os parâmetros salvos
    hasUtms: Object.keys(utms).length > 0,
    hasTrackingParams: Object.keys(allTrackingParams).length > 0,
    navigateWithUtms,
    getUtmQueryString,
    clearUtms,
  };
}

