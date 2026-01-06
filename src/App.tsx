// Force rebuild: 2025-10-21 - Fix edge functions deployment
import React, { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollRestoration from "@/components/ScrollRestoration";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, initCacheSystem } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
// LanguageProvider e LocaleProvider removidos - usando apenas português
import { PublicErrorBoundary } from "@/components/PublicErrorBoundary";
import PublicRoutes from "@/components/PublicRoutes";
// ✅ CRÍTICO: Importar i18n para garantir inicialização antes de qualquer componente
import '@/i18n';
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { devLog, isDevVerbose } from "@/utils/debug/devLogger";
import { ensureE2EAdminStorageAuthorized, isE2EAdminFlagEnabled } from "@/utils/adminE2EBypass";
import { Loader2 } from "lucide-react";

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
const AdminMedia = lazyWithRetry(() => import("./pages/admin/AdminMedia"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const AdminCollaborators = lazyWithRetry(() => import("./pages/admin/AdminCollaborators"));
const AdminEmails = lazyWithRetry(() => import("./pages/admin/AdminEmails"));
const AdminEmailLogs = lazyWithRetry(() => import("./pages/admin/AdminEmailLogs"));
const AdminPayments = lazyWithRetry(() => import("./pages/admin/AdminPayments"));
// AdminExampleTracks removido - apenas português
const AdminQuizMetrics = lazyWithRetry(() => import("./pages/admin/AdminQuizMetrics"));
const AdminFinancial = lazyWithRetry(() => import("./pages/admin/AdminFinancial"));
const AdminAffiliates = lazyWithRetry(() => import("./pages/admin/AdminAffiliates"));
const AdminAuth = lazyWithRetry(() => import("./pages/AdminAuth"));
const Quiz = lazyWithRetry(() => import("./pages/Quiz"));
const Checkout = lazyWithRetry(() => import("./pages/Checkout"));
const CheckoutProcessing = lazyWithRetry(() => import("./pages/CheckoutProcessing"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const CaktoReturn = lazyWithRetry(() => import("./pages/CaktoReturn"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const About = lazyWithRetry(() => import("./pages/About"));
const HowItWorks = lazyWithRetry(() => import("./pages/HowItWorks"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const SongDownload = lazyWithRetry(() => import("./pages/SongDownload"));
const ApproveLyrics = lazyWithRetry(() => import("./pages/ApproveLyrics"));
// Componentes principais
// LocaleRouter removido - usando apenas português
const AdminDashboardRedirect = lazyWithRetry(() => import("./components/admin/AdminDashboardRedirect"));

// ✅ REFATORAÇÃO: Rotas de debug/teste removidas em produção
// Descomente apenas se necessário para debug em desenvolvimento
// const IPDebugger = lazyWithRetry(() => import("./components/IPDebugger"));
// const LanguageStatus = lazyWithRetry(() => import("./components/LanguageStatus"));
// const LanguageDebugger = lazyWithRetry(() => import("./components/LanguageDebugger"));
// const LocaleTest = lazyWithRetry(() => import("./components/LocaleTest"));
// const SimpleLocaleTest = lazyWithRetry(() => import("./components/SimpleLocaleTest"));
// const ForceLocaleTest = lazyWithRetry(() => import("./components/ForceLocaleTest"));
// const SimpleTranslationTest = lazyWithRetry(() => import("./components/SimpleTranslationTest"));
// const SimpleLocaleTestPage = lazyWithRetry(() => import("./pages/SimpleLocaleTestPage"));
// const RouteTester = lazyWithRetry(() => import("./components/RouteTester"));
// const LanguageAnalyticsDashboard = lazyWithRetry(() => import("./components/LanguageAnalyticsDashboard"));
// const LocaleForceTest = lazyWithRetry(() => import("./components/LocaleForceTest"));
// const RedirectTest = lazyWithRetry(() => import("./components/RedirectTest"));
// const MusicTranslationTest = lazyWithRetry(() => import("./components/MusicTranslationTest"));
// const MusicDebugger = lazyWithRetry(() => import("./components/MusicDebugger"));
// const MusicDirectionTest = lazyWithRetry(() => import("./components/MusicDirectionTest"));
// const TranslationTest = lazyWithRetry(() => import("./components/TranslationTest"));
// const TranslationDebugger = lazyWithRetry(() => import("./components/TranslationDebugger"));
// const LanguageDetectionTest = lazyWithRetry(() => import("./components/LanguageDetectionTest"));
// const TestCountryDetection = lazyWithRetry(() => import("./pages/test-country-detection"));

// ✅ CORREÇÃO: PageLoader removido - não mostrar nenhum loading
// O site deve aparecer imediatamente sem indicadores de carregamento
const PageLoader = () => null;
const AdminRouteFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// ✅ OTIMIZAÇÃO: QueryClient otimizado importado de @/lib/queryClient
// Configuração balanceada: cache de 5min, stale de 1min, refetch inteligente

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const AppContent = () => {
  // ✅ CORREÇÃO LOADING INFINITO: Logs de diagnóstico no início do AppContent
  const isLoading = false;
  const location = useLocation();
  const navigate = useNavigate();
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/08412bf1-75eb-4fbc-b0f3-f947bf663281',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:110',message:'AppContent render',data:{pathname:location.pathname,isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
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
      initCacheSystem().catch((error) => {
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

  // ✅ OTIMIZAÇÃO: Prefetch automático de rotas críticas após carregamento inicial
  // Reduzido para 1 segundo e apenas rotas essenciais para melhorar performance inicial
  // ✅ OTIMIZAÇÃO: NÃO prefetch componentes admin - carregar apenas quando necessário
  useEffect(() => {
    if (isLoading) return;
    if (isAdminRoute) return; // Não prefetch se já está em rota admin

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
      // ✅ OTIMIZAÇÃO: Prefetch apenas rotas públicas críticas, não admin
      Promise.all([
        import('./pages/Quiz').catch(() => {}),
        import('./pages/Checkout').catch(() => {})
      ]).catch(() => {});
    };

    const schedulePrefetch = () => {
      if (cancelled) return;
      if ('requestIdleCallback' in win) {
        const w = win as any;
        idleId = w.requestIdleCallback(prefetch, { timeout: 12000 });
        return;
      }
      prefetchTimer = globalThis.setTimeout(prefetch, 6000);
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

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ScrollToTop />
      <ScrollRestoration />
      <PublicErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
              {/* Rotas públicas - apenas português */}
              <Route path="/*" element={<PublicRoutes />} />
            
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
              <Route path="financial" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="financial_management">
                    <AdminFinancial />
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
              <Route path="media" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="media">
                    <AdminMedia />
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
              <Route path="settings" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="settings">
                    <AdminSettings />
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
              <Route path="afiliados" element={
                <Suspense fallback={null}>
                  <ProtectedAdminRoute requiredPermission="orders">
                    <AdminAffiliates />
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
            <Route path="/test/locale-force" element={<LocaleForceTest />} />
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
