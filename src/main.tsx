import React from "react";

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandling } from "./utils/errors/errorHandler";
import { setupErrorSuppression } from "./utils/errors/errorSuppression";
// ✅ CRÍTICO: Inicializar i18n antes de qualquer componente
import "./i18n";

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

// ✅ CORREÇÃO: Configurar supressão de erros conhecidos ANTES do tratamento global
// Isso evita que erros esperados (como UTMify em dev) sejam logados
const cleanupErrorSuppression = setupErrorSuppression();

// ✅ CORREÇÃO: Configurar tratamento global de erros ANTES de tudo
const cleanupErrorHandling = setupGlobalErrorHandling();


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
  
  // ✅ OTIMIZAÇÃO: beforeunload precisa ser síncrono, mas podemos otimizar o código dentro
  window.addEventListener('beforeunload', () => {
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
    cleanupErrorHandling();
    
    // ✅ CAMADA 4 - SALVAMENTO DE ÚLTIMA HORA: Tentar salvar quiz antes de fechar
    // Envia quiz via sendBeacon mesmo que já tenha ID (pode atualizar dados)
    // ✅ OTIMIZAÇÃO: Usar try-catch mínimo e sendBeacon (não bloqueia)
    try {
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
          const beaconUrl = `${supabaseUrl}/functions/v1/quiz-beacon-save`;
          navigator.sendBeacon(beaconUrl, blob);
        }
      }
    } catch (error) {
      // Ignorar erros silenciosamente - não queremos bloquear o fechamento da página
    }
  });
  
  window.addEventListener('popstate', checkHrefChange);
  window.addEventListener('hashchange', checkHrefChange);
}

// Tratamento de erro robusto na inicialização do React
// Função para inicializar React com tratamento de erro
function initializeReact() {
  try {
    const getOrCreateRoot = () => {
      const existingRoot = document.getElementById("root");
      if (existingRoot) return existingRoot;

      if (isDev) {
        console.warn('⚠️ [Main] Elemento root não encontrado! Criando novo elemento...');
      }
      const newRoot = document.createElement('div');
      newRoot.id = 'root';
      document.body.appendChild(newRoot);
      return newRoot;
    };

    const getOrCreateMount = (root: HTMLElement) => {
      const existingMount = document.getElementById('app-root');
      if (existingMount) return existingMount;
      const mount = document.createElement('div');
      mount.id = 'app-root';
      root.prepend(mount);
      return mount;
    };

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

    const rootHost = getOrCreateRoot();
    const mountElement = getOrCreateMount(rootHost);
    
    try {
      const root = createRoot(mountElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      finalizeBoot();
    } catch (renderError) {
      console.error('❌ [Main] Erro ao renderizar React:', renderError);
      try {
        const root = createRoot(mountElement);
        root.render(<App />);
        finalizeBoot();
      } catch (fallbackError) {
        console.error('❌ [Main] Erro crítico ao inicializar React:', fallbackError);
        rootHost.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Erro ao carregar a aplicação</h1><p>Por favor, recarregue a página.</p></div>';
      }
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
        const mountElement = document.getElementById('app-root') || (() => {
          const mount = document.createElement('div');
          mount.id = 'app-root';
          rootHost.prepend(mount);
          return mount;
        })();
        const root = createRoot(mountElement);
        root.render(<App />);
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

// Aguardar DOM estar pronto antes de inicializar React
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeReact();
  });
} else {
  // DOM já está pronto, inicializar imediatamente
  initializeReact();
}
