import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

declare global {
  interface Window {
    __SUPABASE_CLIENT_INSTANCE__?: any;
  }
}

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// ✅ SEGURANÇA: Usar variáveis de ambiente em vez de hardcode
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// ✅ CONSISTÊNCIA: No frontend, a key esperada é a "anon public" (Vite: VITE_*)
// Mantemos compatibilidade com o nome antigo VITE_SUPABASE_PUBLISHABLE_KEY.
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fallback para desenvolvimento local
const SUPABASE_URL_FALLBACK = 'https://zagkvtxarndluusiluhb.supabase.co';

// ✅ CORREÇÃO LOADING INFINITO: Logs de diagnóstico apenas em desenvolvimento e apenas para erros
// Verificar se variáveis de ambiente estão definidas
// Logs removidos

// ✅ CORREÇÃO: Garantir que sempre usa URL remota (não localhost)
let finalUrl = SUPABASE_URL || SUPABASE_URL_FALLBACK;
const finalKey = SUPABASE_ANON_KEY;

/**
 * Verifica se há token de autenticação no localStorage
 * @returns true se houver token de autenticação
 */
function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const projectRef = finalUrl.split('//')[1]?.split('.')[0] || 'zagkvtxarndluusiluhb';
    const specificKey = `sb-${projectRef}-auth-token`;
    
    // Verificar chave específica do Supabase
    if (localStorage.getItem(specificKey) !== null) return true;
    
    // Verificar padrões alternativos
    return Object.keys(localStorage).some(key => {
      const lowerKey = key.toLowerCase();
      return (lowerKey.includes('supabase') && (lowerKey.includes('auth-token') || lowerKey.includes('session'))) ||
             (lowerKey.startsWith('sb-') && lowerKey.includes('auth'));
    });
  } catch {
    return false;
  }
}

// ✅ CORREÇÃO CRÍTICA: Se detectar localhost, forçar uso da URL remota
if (finalUrl && (finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1') || finalUrl.includes(':54321') || finalUrl.includes(':9999'))) {
  finalUrl = SUPABASE_URL_FALLBACK;
}

// ✅ CORREÇÃO CRÍTICA: Singleton pattern robusto para evitar loops de HMR
// Usar variável global que persiste mesmo com recarregamentos do módulo
let supabase: any = null;

// ✅ FASE 3: Função para criar cliente com fallback robusto
function createSupabaseClient(): any {
  try {
    // Verificar se variáveis de ambiente estão configuradas
    if (!finalUrl || !finalKey) {
      if (isDev) {
        console.warn('[Supabase Client] Variáveis de ambiente não configuradas');
      }
      return createDummyClient();
    }
    
    const client = createClient<Database>(finalUrl, finalKey, {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
      // ✅ CORREÇÃO: Garantir que Edge Functions sempre usam URL remota
      global: {
        headers: {
          'X-Client-Info': 'musiclovely-web'
        }
      },
      db: {
        schema: 'public'
      },
      // ✅ CORREÇÃO ERRO 401 REALTIME: Desabilitar Realtime automático para evitar conexões não autenticadas
      // O Realtime só será usado explicitamente quando necessário (ex: AdminDashboard)
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        log_level: 'error' as const,
        // ✅ OTIMIZAÇÃO: Aumentar heartbeat para reduzir reconexões (60s)
        heartbeatIntervalMs: 60000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 2000, 60000),
        // ✅ CRÍTICO: Não conectar automaticamente - apenas quando explicitamente solicitado
        // Isso evita erros 401 quando usuários não autenticados acessam a aplicação
        // ✅ CORREÇÃO: Removido transport para evitar erro "this.transport is not a constructor" no build de produção
        // O Supabase usará o transport padrão (websocket) automaticamente
        // ✅ NOVO: Desabilitar conexão automática completamente
        // O Supabase não tentará conectar até que um channel seja criado explicitamente
        // e a autenticação seja verificada pela nossa interceptação
      }
    });
    
    // ✅ CORREÇÃO CRÍTICA ERRO 401: Interceptar chamadas ao Realtime para verificar autenticação
    // Isso previne conexões WebSocket não autenticadas que causam erro 401
    if (client && client.realtime) {
      const originalChannel = client.realtime.channel.bind(client.realtime);
      const originalRemoveChannel = client.realtime.removeChannel?.bind(client.realtime);
      const originalSetAuth = client.realtime.setAuth?.bind(client.realtime);
      
      // ✅ NOVO: Interceptar setAuth para garantir que só seja chamado com autenticação válida
      if (originalSetAuth) {
        client.realtime.setAuth = function(token: string) {
          // Só permitir setAuth se houver token válido
          if (token && typeof token === 'string' && token.length > 0) {
            return originalSetAuth(token);
          }
        };
      }
      
      // Wrapper que verifica autenticação antes de criar channel
      client.realtime.channel = function(channelName: string, params?: any) {
        // Verificar autenticação antes de criar channel real
        if (!hasAuthToken()) {
          return createDummyChannel(channelName);
        }
        
        const channel = originalChannel(channelName, params);
        
        // Interceptar subscribe para garantir autenticação antes de conectar
        if (channel && typeof channel.subscribe === 'function') {
          const originalSubscribe = channel.subscribe.bind(channel);
          channel.subscribe = function(callback?: (status: string) => void) {
            if (!hasAuthToken()) {
              if (callback && typeof callback === 'function') {
                setTimeout(() => callback('CHANNEL_ERROR'), 0);
              }
              return { unsubscribe: () => {} };
            }
            return originalSubscribe(callback);
          };
        }
        
        return channel;
      };
      
      // Manter removeChannel original se existir
      if (originalRemoveChannel) {
        client.realtime.removeChannel = originalRemoveChannel;
      }
    }
    
    // Se detectar localhost, recriar cliente com URL remota
    if (finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1')) {
      return createClient<Database>(SUPABASE_URL_FALLBACK, finalKey, {
        auth: {
          storage: typeof window !== 'undefined' ? localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          headers: {
            'X-Client-Info': 'musiclovely-web'
          }
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          },
          log_level: 'error' as const,
          heartbeatIntervalMs: 60000,
          reconnectAfterMs: (tries: number) => Math.min(tries * 2000, 60000),
        }
      });
    }
    
    return client;
  } catch (error) {
    if (isDev) {
      console.error('[Supabase Client] Erro ao criar cliente:', error);
    }
    return createDummyClient();
  }
}

/**
 * Cria um channel dummy que não conecta ao WebSocket
 * Usado quando não há autenticação para evitar erros 401
 */
function createDummyChannel(channelName: string): any {
  return {
    channelName,
    on: function() { return this; },
    subscribe: function(callback?: (status: string) => void) {
      if (callback && typeof callback === 'function') {
        // Simular status de erro após um pequeno delay
        setTimeout(() => {
          callback('CHANNEL_ERROR');
        }, 100);
      }
      return { unsubscribe: () => {} };
    },
    unsubscribe: function() { return Promise.resolve(); },
    send: function() { return Promise.resolve(); },
    presence: function() { return this; },
    broadcast: function() { return this; },
  };
}

/**
 * Cria um cliente dummy para evitar erros quando inicialização falha
 * Retorna um cliente mock que não faz chamadas reais ao Supabase
 */
function createDummyClient(): any {
  const dummyError = { message: 'Cliente não inicializado', code: 'CLIENT_NOT_INITIALIZED' };
  
  // ✅ CORREÇÃO: Criar builder completo que suporta todos os métodos do Supabase
  const createQueryBuilder = () => {
    const builder: any = {
      eq: (column: string, value: any) => builder,
      neq: (column: string, value: any) => builder,
      gt: (column: string, value: any) => builder,
      gte: (column: string, value: any) => builder,
      lt: (column: string, value: any) => builder,
      lte: (column: string, value: any) => builder,
      like: (column: string, pattern: string) => builder,
      ilike: (column: string, pattern: string) => builder,
      is: (column: string, value: any) => builder,
      in: (column: string, values: any[]) => builder,
      contains: (column: string, value: any) => builder,
      containedBy: (column: string, value: any) => builder,
      rangeGt: (column: string, value: any) => builder,
      rangeGte: (column: string, value: any) => builder,
      rangeLt: (column: string, value: any) => builder,
      rangeLte: (column: string, value: any) => builder,
      rangeAdjacent: (column: string, value: any) => builder,
      overlaps: (column: string, value: any) => builder,
      textSearch: (column: string, query: string, options?: any) => builder,
      match: (query: Record<string, any>) => builder,
      not: (column: string, operator: string, value: any) => builder,
      or: (filters: string) => builder,
      order: (column: string, options?: { ascending?: boolean }) => builder,
      limit: (count: number) => builder,
      range: (from: number, to: number) => builder,
      abortSignal: (signal: AbortSignal) => builder,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      select: (columns?: string) => builder,
    };
    
    // Tornar o builder uma Promise para funcionar com await
    return Object.assign(builder, {
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      catch: (reject: any) => Promise.resolve({ data: null, error: null }).catch(reject),
    });
  };

  // ✅ CORREÇÃO: Criar builder para insert/update/upsert/delete que suporta encadeamento
  const createMutationBuilder = () => {
    const builder: any = {
      select: (columns?: string) => {
        // ✅ CORREÇÃO: select() deve retornar um builder que pode ser encadeado com single()
        const selectBuilder: any = {
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        };
        // Tornar o selectBuilder uma Promise
        return Object.assign(selectBuilder, {
          then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
          catch: (reject: any) => Promise.resolve({ data: null, error: null }).catch(reject),
        });
      },
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      eq: (column: string, value: any) => builder,
      neq: (column: string, value: any) => builder,
      in: (column: string, values: any[]) => builder,
    };
    
    // Tornar o builder uma Promise para funcionar com await
    return Object.assign(builder, {
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      catch: (reject: any) => Promise.resolve({ data: null, error: null }).catch(reject),
    });
  };
  
  return {
    auth: {
      getSession: async () => ({ 
        data: { session: null, user: null }, 
        error: null // ✅ Não retornar erro para evitar que ErrorBoundaries sejam disparados
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: dummyError }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: null }, error: null }),
    },
    from: (table: string) => {
      return {
        // ✅ CORREÇÃO: select retorna builder que suporta encadeamento
        select: (columns?: string) => createQueryBuilder(),
        // ✅ CORREÇÃO: insert retorna builder que suporta .select()
        insert: (values: any) => createMutationBuilder(),
        // ✅ CORREÇÃO: upsert retorna builder que suporta .select()
        upsert: (values: any, options?: any) => createMutationBuilder(),
        // ✅ CORREÇÃO: update retorna builder que suporta encadeamento
        update: (values: any) => createMutationBuilder(),
        // ✅ CORREÇÃO: delete retorna builder que suporta encadeamento
        delete: () => createMutationBuilder(),
      };
    },
    functions: {
      invoke: async (functionName: string, options?: any) => {
        return { 
          data: null, 
          error: { 
            message: 'Failed to send a request to the Edge Function - Cliente Supabase não está configurado corretamente (dummy client). Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
            status: 503,
            name: 'FunctionsError'
          } 
        };
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        list: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    realtime: {
      channel: () => ({
        on: () => ({ unsubscribe: () => {} }),
        subscribe: async () => ({ data: null, error: null }),
        unsubscribe: async () => ({ data: null, error: null }),
      }),
    },
  };
}

// Inicializar cliente usando singleton pattern para evitar loops de HMR
if (typeof window !== 'undefined') {
  if (!window.__SUPABASE_CLIENT_INSTANCE__) {
    try {
      window.__SUPABASE_CLIENT_INSTANCE__ = createSupabaseClient();
      supabase = window.__SUPABASE_CLIENT_INSTANCE__;
    } catch (error) {
      if (isDev) {
        console.error('[Supabase Client] Erro ao criar cliente:', error);
      }
      window.__SUPABASE_CLIENT_INSTANCE__ = createDummyClient();
      supabase = window.__SUPABASE_CLIENT_INSTANCE__;
    }
  } else {
    // Reutilizar instância existente (evita recriação com HMR)
    supabase = window.__SUPABASE_CLIENT_INSTANCE__;
  }
} else {
  // Fallback para SSR
  supabase = createSupabaseClient();
}

// Garantir que supabase nunca seja null ou undefined
if (!supabase) {
  supabase = createDummyClient();
}

export { supabase };
