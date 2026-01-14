import React from "react";

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// Debug logs removidos para otimização de performance

// Log removido para reduzir verbosidade
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// ✅ OTIMIZAÇÃO: CSS carregado de forma diferida (ver index.html)
// import "./index.css"; // Movido para carregamento diferido
// ✅ OTIMIZAÇÃO: Error handlers e i18n carregados após paint
// import { setupGlobalErrorHandling } from "./utils/errors/errorHandler";
// import { setupErrorSuppression } from "./utils/errors/errorSuppression";
// import "./i18n"; // Carregado de forma diferida

import { setupGlobalErrorHandling } from "./utils/errors/errorHandler";
import { setupErrorSuppression } from "./utils/errors/errorSuppression";

const patchDomNotFoundErrors = () => {
  const NodeProto = (globalThis as any)?.Node?.prototype;
  if (!NodeProto) return;
  if ((globalThis as any).__ML_DOM_PATCHED__) return;
  (globalThis as any).__ML_DOM_PATCHED__ = true;

  const originalInsertBefore = NodeProto.insertBefore;
  const originalAppendChild = NodeProto.appendChild;
  const originalRemoveChild = NodeProto.removeChild;

  NodeProto.insertBefore = function (newChild: Node, refChild: Node | null) {
    try {
      if (refChild && refChild.parentNode !== this) {
        return originalAppendChild.call(this, newChild);
      }
      return originalInsertBefore.call(this, newChild, refChild);
    } catch (error: any) {
      if (error?.name === 'NotFoundError') {
        try {
          return originalAppendChild.call(this, newChild);
        } catch {
          return newChild;
        }
      }
      throw error;
    }
  };

  NodeProto.removeChild = function (child: Node) {
    try {
      if (child && child.parentNode !== this) {
        return child;
      }
      return originalRemoveChild.call(this, child);
    } catch (error: any) {
      if (error?.name === 'NotFoundError') {
        return child;
      }
      throw error;
    }
  };
};

if (typeof window !== 'undefined') {
  patchDomNotFoundErrors();
}

// ✅ CORREÇÃO: Declarar tipos para propriedades globais do window
declare global {
  interface Window {
    __REACT_READY__?: boolean;
    fbq?: {
      (...args: any[]): void;
      q: any[][];
      l: number;
      queue: any[][];
    };
  }
}

// ✅ OTIMIZAÇÃO: Error handlers e i18n carregados após paint para não bloquear FCP
let cleanupErrorSuppression: (() => void) | null = null;
let cleanupErrorHandling: (() => void) | null = null;

// i18n removido - sempre português do Brasil

const setupErrorHandlers = () => {
  if (cleanupErrorSuppression || cleanupErrorHandling) return;
  try {
    cleanupErrorSuppression = setupErrorSuppression();
    cleanupErrorHandling = setupGlobalErrorHandling();
  } catch {
  }
};

// i18n removido - sempre português do Brasil
// Error handlers carregados após primeiro paint
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(setupErrorHandlers, 200);
    });
  });
}

// ✅ Tracking de comportamento removido conforme solicitado (save-behavior-event)

// ✅ FASE 5: Monitoramento de recarregamentos (sem interceptar para evitar loops)
if (typeof window !== 'undefined') {
  let lastReloadTime = 0;
  let reloadCount = 0;
  const MAX_RELOADS_PER_MINUTE = 3;
  const RELOAD_COOLDOWN_MS = 20000; // 20 segundos (reduzido para detectar loops mais rapidamente)
  
  // ✅ FASE 5: Apenas MONITORAR recarregamentos, não interceptar
  // Interceptar pode causar loops, então vamos apenas logar
  
  // Monitorar mudanças de URL via eventos
  let lastHrefChange = 0;
  let hrefChangeCount = 0;
  const MAX_HREF_CHANGES_PER_SECOND = 10;
  const HREF_CHANGE_COOLDOWN_MS = 1000; // 1 segundo
  
  // ✅ OTIMIZAÇÃO: Mover verificação de href para requestIdleCallback para não bloquear thread principal
  const checkHrefChange = () => {
    const win = typeof window !== 'undefined' ? window : null;
    if (!win || !('requestIdleCallback' in win)) {
      // Fallback síncrono se requestIdleCallback não estiver disponível
      const now = Date.now();
      const timeSinceLastChange = now - lastHrefChange;
      
      if (timeSinceLastChange < HREF_CHANGE_COOLDOWN_MS && lastHrefChange > 0) {
        hrefChangeCount++;
        if (isDev) {
          console.warn(`⚠️ [Main] Mudança de URL detectada rapidamente (${hrefChangeCount} vez(es) em ${Math.round(timeSinceLastChange)}ms)`);
          
          if (hrefChangeCount >= MAX_HREF_CHANGES_PER_SECOND) {
            console.error('❌ [Main] POSSÍVEL LOOP DE NAVEGAÇÃO DETECTADO! Verifique o console para mais detalhes.');
          }
        }
      } else {
        hrefChangeCount = 0;
      }
      
      lastHrefChange = now;
      return;
    }

    // Usar requestIdleCallback para não bloquear thread principal
    (win as any).requestIdleCallback(() => {
      const now = Date.now();
      const timeSinceLastChange = now - lastHrefChange;
      
      if (timeSinceLastChange < HREF_CHANGE_COOLDOWN_MS && lastHrefChange > 0) {
        hrefChangeCount++;
        if (isDev) {
          console.warn(`⚠️ [Main] Mudança de URL detectada rapidamente (${hrefChangeCount} vez(es) em ${Math.round(timeSinceLastChange)}ms)`);
          
          if (hrefChangeCount >= MAX_HREF_CHANGES_PER_SECOND) {
            console.error('❌ [Main] POSSÍVEL LOOP DE NAVEGAÇÃO DETECTADO! Verifique o console para mais detalhes.');
          }
        }
      } else {
        hrefChangeCount = 0;
      }
      
      lastHrefChange = now;
    }, { timeout: 100 });
  };
  
  // ✅ OTIMIZAÇÃO: Usar pagehide ao invés de beforeunload para não bloquear bfcache
  // pagehide é disparado quando a página está sendo descarregada mas não bloqueia bfcache
  // Função helper para salvar quiz
  const savePendingQuiz = () => {
    try {
      if (import.meta.env.DEV) return;
      if (!navigator.sendBeacon) return;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
      const pendingQuiz = localStorage.getItem('pending_quiz');
      if (pendingQuiz && navigator.sendBeacon) {
        const quiz = JSON.parse(pendingQuiz);
        const sessionId = quiz.session_id || quiz.answers?.session_id;
        
        if (sessionId) {
          const quizData = {
            session_id: sessionId,
            about_who: quiz.about_who,
            relationship: quiz.relationship,
            style: quiz.style,
            language: quiz.language || 'pt',
            vocal_gender: quiz.vocal_gender || null,
            qualities: quiz.qualities,
            memories: quiz.memories,
            message: quiz.message || null,
            key_moments: quiz.key_moments,
            occasion: quiz.occasion || null,
            desired_tone: quiz.desired_tone || null,
            answers: quiz.answers || {},
            customer_email: quiz.customer_email || null,
            customer_whatsapp: quiz.customer_whatsapp || null
          };
          
          const blob = new Blob([JSON.stringify(quizData)], { type: 'application/json' });
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
          if (!supabaseUrl.startsWith('https://')) return;
          const beaconUrl = `${supabaseUrl}/functions/v1/quiz-beacon-save`;
          navigator.sendBeacon(beaconUrl, blob);
        }
      }
    } catch (error) {
      // Ignorar erros silenciosamente
    }
  };

  // Usar pagehide (não bloqueia bfcache)
  window.addEventListener('pagehide', (event) => {
    const now = Date.now();
    const timeSinceLastReload = now - lastReloadTime;
    
    // Verificação rápida primeiro (não bloqueia)
    if (timeSinceLastReload < RELOAD_COOLDOWN_MS && lastReloadTime > 0) {
      reloadCount++;
      if (isDev) {
        console.warn(`⚠️ [Main] Recarregamento detectado rapidamente (${reloadCount} vez(es) em ${Math.round(timeSinceLastReload / 1000)}s)`);
        
        if (reloadCount >= MAX_RELOADS_PER_MINUTE) {
          console.error('❌ [Main] POSSÍVEL LOOP DE RECARREGAMENTO DETECTADO!');
        }
      }
    } else {
      reloadCount = 0;
    }
    
    lastReloadTime = now;
    if (cleanupErrorHandling) {
      cleanupErrorHandling();
    }
    savePendingQuiz();
  });

  // Também salvar quando a página fica oculta (não bloqueia bfcache)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      savePendingQuiz();
    }
  });
  
  window.addEventListener('popstate', checkHrefChange);
  window.addEventListener('hashchange', checkHrefChange);
}

// ✅ Loading removido do HTML - página carrega diretamente

// ✅ CORREÇÃO LOADING INFINITO: Logs removidos para reduzir verbosidade

// ✅ CORREÇÃO: Tratamento de erro robusto na inicialização do React
// Função para inicializar React com tratamento de erro
let reactRoot: ReturnType<typeof createRoot> | null = null;
let reactContainer: HTMLElement | null = null;

function initializeReact() {
  try {
    const finalizeBoot = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__REACT_READY__ = true;
          window.dispatchEvent(new Event('react-ready'));
          const placeholder = document.getElementById('ml-placeholder');
          if (placeholder) {
            placeholder.remove();
          }
        });
      });
    };

    const rootHost = document.getElementById("root") || (() => {
      if (isDev) {
        console.warn('⚠️ [Main] Elemento root não encontrado! Criando novo elemento...');
      }
      const newRoot = document.createElement('div');
      newRoot.id = 'root';
      document.body.appendChild(newRoot);
      return newRoot;
    })();

    if (reactRoot && reactContainer && reactContainer !== rootHost) {
      try {
        reactRoot.unmount();
      } catch {
      }
      reactRoot = null;
    }

    reactContainer = rootHost;
    reactRoot = reactRoot ?? createRoot(rootHost);

    let didRender = false;
    try {
      reactRoot.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      didRender = true;
    } catch (renderError) {
      console.error('❌ [Main] Erro ao renderizar React:', renderError);
      try {
        reactRoot.render(<App />);
        didRender = true;
      } catch (fallbackError) {
        console.error('❌ [Main] Erro crítico ao inicializar React:', fallbackError);
        rootHost.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Erro ao carregar a aplicação</h1><p>Por favor, recarregue a página.</p></div>';
      }
    }

    if (didRender) {
      finalizeBoot();
    }
  } catch (error) {
    console.error('❌ [Main] Erro crítico na inicialização do React:', error);
    // Último recurso: tentar criar root e renderizar após um delay
    setTimeout(() => {
      try {
        const rootHost = document.getElementById("root") || (() => {
          const newRoot = document.createElement('div');
          newRoot.id = 'root';
          document.body.appendChild(newRoot);
          return newRoot;
        })();

        if (reactRoot && reactContainer && reactContainer !== rootHost) {
          try {
            reactRoot.unmount();
          } catch {
          }
          reactRoot = null;
        }

        reactContainer = rootHost;
        reactRoot = reactRoot ?? createRoot(rootHost);
        reactRoot.render(<App />);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.__REACT_READY__ = true;
            window.dispatchEvent(new Event('react-ready'));
            const placeholder = document.getElementById('ml-placeholder');
            if (placeholder) {
              placeholder.remove();
            }
          });
        });
      } catch (retryError) {
        console.error('❌ [Main] Falha total na inicialização do React:', retryError);
      }
    }, 1000);
  }
}

// ✅ CORREÇÃO: Aguardar DOM estar pronto antes de inicializar React
// ✅ AUDITORIA: Log removido em produção
// console.log('🔍 [Main] Verificando estado do DOM antes de inicializar React...', {
//   readyState: document.readyState,
//   rootExists: !!document.getElementById('root'),
//   reactAvailable: typeof React !== 'undefined',
//   reactDOMAvailable: typeof createRoot !== 'undefined'
// });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeReact();
  });
} else {
  // ✅ CORREÇÃO: Inicializar imediatamente sem setTimeout - React deve renderizar o mais rápido possível
  // O setTimeout estava causando delay desnecessário que poderia fazer o loading ficar preso
  initializeReact();
}
