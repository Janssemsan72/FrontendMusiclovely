// Force rebuild: 2025-10-21 - Fix edge functions deployment
import React, { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollRestoration from "@/components/ScrollRestoration";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
// LanguageProvider e LocaleProvider removidos - usando apenas português
import { PublicErrorBoundary } from "@/components/PublicErrorBoundary";
import PublicRoutes from "@/components/PublicRoutes";
// ✅ OTIMIZAÇÃO: i18n carregado de forma diferida no main.tsx para não bloquear FCP
// import '@/i18n'; // Removido - carregado diferidamente
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { devLog, isDevVerbose } from "@/utils/debug/devLogger";
import { ensureE2EAdminStorageAuthorized, isE2EAdminFlagEnabled } from "@/utils/adminE2EBypass";

// ✅ CORREÇÃO: Lazy load com retry para resolver "Failed to fetch dynamically imported module"
// const Index = lazyWithRetry(() => import("./pages/Index"));
const AdminErrorBoundary = lazyWithRetry(() =>
  import("./components/AdminErrorBoundary").then((m) => ({ default: m.AdminErrorBoundary }))
);
const ProtectedAdminRoute = lazyWithRetry(() =>
  import("./components/admin/ProtectedAdminRoute").then((m) => ({ default: m.ProtectedAdminRoute }))
);
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"));
const AdminOrders = lazyWithRetry(() => import("./pages/admin/AdminOrders"));
const AdminOrderDetails = lazyWithRetry(() => import("./pages/admin/AdminOrderDetails"));
const AdminSongs = lazyWithRetry(() => import("./pages/admin/AdminSongs"));
const AdminSongDetails = lazyWithRetry(() => import("./pages/admin/AdminSongDetails"));
const AdminLogs = lazyWithRetry(() => import("./pages/admin/AdminLogs"));
const AdminLyrics = lazyWithRetry(() => import("./pages/admin/AdminLyrics"));
const AdminReleases = lazyWithRetry(() => import("./pages/admin/AdminReleases"));
const AdminCollaborators = lazyWithRetry(() => import("./pages/admin/AdminCollaborators"));
const AdminEmails = lazyWithRetry(() => import("./pages/admin/AdminEmails"));
const AdminEmailLogs = lazyWithRetry(() => import("./pages/admin/AdminEmailLogs"));
const AdminPayments = lazyWithRetry(() => import("./pages/admin/AdminPayments"));
// AdminExampleTracks removido - apenas português
const AdminQuizMetrics = lazyWithRetry(() => import("./pages/admin/AdminQuizMetrics"));
const AdminAuth = lazyWithRetry(() => import("./pages/AdminAuth"));
const CheckoutProcessing = lazyWithRetry(() => import("./pages/CheckoutProcessing"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const CaktoReturn = lazyWithRetry(() => import("./pages/CaktoReturn"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const SongDownload = lazyWithRetry(() => import("./pages/SongDownload"));
const ApproveLyrics = lazyWithRetry(() => import("./pages/ApproveLyrics"));
// Componentes principais
// LocaleRouter removido - usando apenas português
const AdminDashboardRedirect = lazyWithRetry(() => import("./components/admin/AdminDashboardRedirect"));


// ✅ CORREÇÃO: PageLoader removido - não mostrar nenhum loading
// O site deve aparecer imediatamente sem indicadores de carregamento
const PageLoader = () => null;
const AdminRouteFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

// ✅ OTIMIZAÇÃO: QueryClient otimizado importado de @/lib/queryClient
// Configuração balanceada: cache de 5min, stale de 1min, refetch inteligente

// ✅ OTIMIZAÇÃO PERFORMANCE: Deferir React Query até após paint
const App = () => {
  const [queryRuntime, setQueryRuntime] = useState<null | {
    QueryClientProvider: React.ComponentType<{ client: any; children: React.ReactNode }>;
    queryClient: any;
  }>(null);

  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    let cancelled = false;

    const loadQueryRuntime = async () => {
      try {
        const [rq, qc] = await Promise.all([
          import("@tanstack/react-query"),
          import("@/lib/queryClient"),
        ]);
        if (cancelled) return;
        setQueryRuntime({
          QueryClientProvider: rq.QueryClientProvider as any,
          queryClient: (qc as any).queryClient,
        });
      } catch {
        if (cancelled) return;
        setQueryRuntime(null);
      }
    };

    if (!win) {
      void loadQueryRuntime();
      return () => {
        cancelled = true;
      };
    }

    // Deferir inicialização do QueryClient até após paint
    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(loadQueryRuntime, { timeout: 500 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = setTimeout(loadQueryRuntime, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!queryRuntime) {
    // Renderizar estrutura básica sem QueryClient para FCP mais rápido
    return (
      <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    );
  }

  return (
    <queryRuntime.QueryClientProvider client={queryRuntime.queryClient}>
      <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    </queryRuntime.QueryClientProvider>
  );
};

const AppContent = () => {
  // ✅ CORREÇÃO LOADING INFINITO: Logs de diagnóstico no início do AppContent
  const isLoading = false;
  const location = useLocation();
  const navigate = useNavigate();
  
  if (isDevVerbose) {
    devLog.debug('[App] AppContent renderizando...', {
      pathname: typeof window !== 'undefined' ? window.location.pathname : location.pathname,
      timestamp: new Date().toISOString()
    });
  }
  
  // ✅ CORREÇÃO: Rotas admin não precisam de traduções, não bloquear
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/app/admin');

  useEffect(() => {
    if (!isAdminRoute) return;
    if (!ensureE2EAdminStorageAuthorized()) return;
    if (location.pathname === '/admin/auth') {
      navigate('/admin', { replace: true });
    }
  }, [isAdminRoute, location.pathname, navigate]);

  useEffect(() => {
    if (!isAdminRoute) return;

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      import("@/lib/queryClient")
        .then((m) => m.initCacheSystem())
        .catch((error) => {
          console.error('❌ [App] Erro ao inicializar sistema de cache:', error);
        });
    };

    const win = typeof window === 'undefined' ? undefined : (window as any);
    let idleId: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const maybeUnregisterAdminServiceWorker = async () => {
      if (!win) return;
      if (!('serviceWorker' in navigator)) return;

      const shouldBypass = ensureE2EAdminStorageAuthorized() || isE2EAdminFlagEnabled();
      if (!shouldBypass) return;

      const reloadKey = 'admin_sw_unregistered_reload_done';
      const shouldReloadOnce = Boolean(navigator.serviceWorker.controller) && win.sessionStorage?.getItem(reloadKey) !== 'true';

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));

      if (shouldReloadOnce) {
        win.sessionStorage?.setItem(reloadKey, 'true');
        win.location.reload();
      }
    };

    maybeUnregisterAdminServiceWorker().catch(() => {});

    const schedule = () => {
      if (cancelled) return;
      if (win && 'requestIdleCallback' in win) {
        idleId = win.requestIdleCallback(start, { timeout: 8000 });
        return;
      }
      timer = setTimeout(start, 4000);
    };

    const ready = typeof document === 'undefined' ? 'complete' : document.readyState;
    if (ready === 'complete') {
      schedule();
    } else if (win) {
      win.addEventListener('load', schedule, { once: true });
    } else {
      schedule();
    }

    return () => {
      cancelled = true;
      if (timer != null) {
        clearTimeout(timer);
      }
      if (idleId != null && win && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (win) {
        win.removeEventListener('load', schedule);
      }
    };
  }, [isAdminRoute]);
  
  if (isDevVerbose) {
    devLog.debug('[App] AppContent estado:', {
      isLoading,
      isAdminRoute,
      pathname: location.pathname
    });
  }

  // ✅ OTIMIZAÇÃO PERFORMANCE: Prefetch automático de rotas críticas apenas após paint e idle
  useEffect(() => {
    if (isLoading) return;
    if (isAdminRoute) return;

    const win = typeof window === "undefined" ? undefined : window;
    if (!win) return;

    const connection = (navigator as any)?.connection;
    if (connection?.saveData) return;
    const effectiveType = connection?.effectiveType;
    if (effectiveType && effectiveType !== '4g') return;
    
    let cancelled = false;
    let idleId: any = null;
    let prefetchTimer: ReturnType<typeof setTimeout> | null = null;
    const prefetch = () => {
      if (cancelled) return;
      Promise.all([
        import('./pages/Quiz').catch(() => {}),
        import('./pages/Checkout/index').catch(() => {}),
        // Prefetch de componentes UI críticos do Checkout
        import('./components/ui/button').catch(() => {}),
        import('./components/ui/card').catch(() => {}),
        import('./components/ui/input').catch(() => {}),
        import('./components/ui/badge').catch(() => {}),
      ]).catch(() => {});
    };

    const schedulePrefetch = () => {
      if (cancelled) return;
      // ✅ OTIMIZAÇÃO: Prefetch mais cedo (reduzido de 12s para 3s)
      if ('requestIdleCallback' in win) {
        const w = win as any;
        idleId = w.requestIdleCallback(prefetch, { timeout: 3000 });
        return;
      }
      // ✅ OTIMIZAÇÃO: Prefetch mais cedo (reduzido de 6s para 2s)
      prefetchTimer = globalThis.setTimeout(prefetch, 2000);
    };

    const onFirstInteraction = () => {
      schedulePrefetch();
    };

    win.addEventListener('pointerdown', onFirstInteraction, { once: true, passive: true });
    win.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
    win.addEventListener('keydown', onFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      win.removeEventListener('pointerdown', onFirstInteraction);
      win.removeEventListener('touchstart', onFirstInteraction);
      win.removeEventListener('keydown', onFirstInteraction);
      if (prefetchTimer != null) {
        globalThis.clearTimeout(prefetchTimer);
      }
      if (idleId != null && typeof (win as any).cancelIdleCallback === 'function') {
        (win as any).cancelIdleCallback(idleId);
      }
    };
  }, [isLoading, isAdminRoute]);
  
  // ✅ CORREÇÃO: Tratamento de promises não tratadas já está em errorHandler.ts
  // Não duplicar aqui para evitar conflitos
  
  // ✅ CORREÇÃO: Não bloquear renderização - usar fallback de traduções
  // As traduções serão carregadas em background e o fallback será usado se necessário
  // Isso evita que as páginas não carreguem se houver problema no carregamento de traduções
  // if (isLoading && !isAdminRoute) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-background">
  //       <div className="text-center space-y-4">
  //         <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  //         <p className="text-sm text-muted-foreground">Carregando...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // ✅ OTIMIZAÇÃO PERFORMANCE: Deferir renderização de componentes não críticos
  const [nonCriticalReady, setNonCriticalReady] = useState(false);

  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : window;
    if (!win) {
      setNonCriticalReady(true);
      return;
    }

    // Deferir até após paint
    if ('requestIdleCallback' in win) {
      const w = win as any;
      const id = w.requestIdleCallback(() => {
        setNonCriticalReady(true);
      }, { timeout: 1000 });
      return () => {
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(id);
        }
      };
    }

    const timer = setTimeout(() => setNonCriticalReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <TooltipProvider>
      {nonCriticalReady && (
        <>
          <Toaster />
          <Sonner />
          <ScrollToTop />
          <ScrollRestoration />
        </>
      )}
      <PublicErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
              {/* Rotas públicas - apenas português */}
              <Route path="/*" element={
                <Suspense fallback={null}>
                  <PublicRoutes />
                </Suspense>
              } />
            
            {/* Admin sem prefixo */}
            <Route
              path="/admin/auth"
              element={ensureE2EAdminStorageAuthorized() ? <Navigate to="/admin" replace /> : <AdminAuth />}
            />
            <Route 
              path="/admin" 
              element={
                <Suspense fallback={<AdminRouteFallback />}>
                  <AdminErrorBoundary>
                    <Suspense fallback={<AdminRouteFallback />}>
                      <AdminLayout />
                    </Suspense>
                  </AdminErrorBoundary>
                </Suspense>
              }
            >
              <Route index element={
                <Suspense fallback={<AdminRouteFallback />}>
                  <AdminDashboardRedirect />
                </Suspense>
              } />
              <Route path="offline" element={
                <Suspense fallback={null}>
                  {React.createElement(lazyWithRetry(() => import("./pages/admin/Offline")))}
                </Suspense>
              } />
              <Route path="orders" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="orders">
                    <AdminOrders />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="orders/:id" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="orders">
                    <AdminOrderDetails />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="payments" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="orders">
                    <AdminPayments />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="songs" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="songs">
                    <AdminSongs />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="songs/:id" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="songs">
                    <AdminSongDetails />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="lyrics" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="lyrics">
                    <AdminLyrics />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="releases" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="releases">
                    <AdminReleases />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="emails" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="emails">
                    <AdminEmails />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="email-logs" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="email_logs">
                    <AdminEmailLogs />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="quiz-metrics" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="dashboard">
                    <AdminQuizMetrics />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              {/* AdminExampleTracks removido - apenas português */}
              <Route path="collaborators" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="collaborators">
                    <AdminCollaborators />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
              <Route path="logs" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="logs">
                    <AdminLogs />
                  </ProtectedAdminRoute>
                </Suspense>
              } />
            </Route>
            
            {/* Compatibility redirect for old /app/admin URLs */}
            <Route path="/app/admin/*" element={<Navigate to="/admin" replace />} />
            
            {/* Cakto payment return routes */}
            <Route path="/cakto-return" element={<CaktoReturn />} />
            
            {/* Global download routes (sem prefixo de idioma) */}
            <Route path="/download/:id/:token" element={<SongDownload />} />
            <Route path="/download/:id" element={<SongDownload />} />
            
            {/* ✅ REFATORAÇÃO: Rotas de debug/teste removidas para produção */}
            {/* Descomente apenas se necessário para debug em desenvolvimento */}
            {/* 
            <Route path="/debug/ip" element={<IPDebugger />} />
            <Route path="/debug/language" element={<LanguageStatus />} />
            <Route path="/debug/locale" element={<LanguageDebugger />} />
            <Route path="/test/locale" element={<LocaleTest />} />
            <Route path="/test/simple" element={<SimpleLocaleTest />} />
            <Route path="/test/force" element={<ForceLocaleTest />} />
            <Route path="/test/simple-translation" element={<SimpleTranslationTest />} />
            <Route path="/test/simple-page" element={<SimpleLocaleTestPage />} />
            <Route path="/test/routes" element={<RouteTester />} />
            <Route path="/test/redirect" element={<RedirectTest />} />
            <Route path="/test/music-translations" element={<MusicTranslationTest />} />
            <Route path="/test/music-direction" element={<MusicDirectionTest />} />
            <Route path="/test/translations" element={<TranslationTest />} />
            <Route path="/debug/translations" element={<TranslationDebugger />} />
            <Route path="/debug/music" element={<MusicDebugger />} />
            <Route path="/test/language-detection" element={<LanguageDetectionTest />} />
            <Route path="/test/country-detection" element={<TestCountryDetection />} />
            <Route path="/analytics/language" element={<LanguageAnalyticsDashboard />} />
            */}
            
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PublicErrorBoundary>
    </TooltipProvider>
  );
};

export default App;
