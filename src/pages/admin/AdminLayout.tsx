import { useEffect, useState, Suspense, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Loader2, Download, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { usePWA } from "@/hooks/usePWA";
import { useAdminAuthGate } from "@/hooks/useAdminAuthGate";
import { OfflineIndicator } from "@/components/admin/OfflineIndicator";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

const InstallPrompt = lazyWithRetry(() => import("@/components/admin/InstallPrompt"));
const WeatherWidget = lazyWithRetry(() =>
  import("@/components/admin/WeatherWidget").then((m) => ({ default: m.WeatherWidget }))
);

export default function AdminLayout() {
  // 1. Todos os hooks no topo
  const navigate = useNavigate();
  const location = useLocation();
  const { isCheckingAuth, isAuthorized, userRole, handleLogout } = useAdminAuthGate({
    navigate,
    pathname: location.pathname,
  });
  const { isInstallable, isInstalled, installPWA, shouldShowNotification, dismissNotification } = usePWA();
  const isMountedRef = useRef(true); // ✅ Verificação de montagem para prevenir erros de DOM
  const notificationShownRef = useRef(false); // ✅ PWA: Evitar múltiplas notificações
  const [nonCriticalEnabled, setNonCriticalEnabled] = useState(false);
  const [showWeatherWidget, setShowWeatherWidget] = useState(false);

  // 2. Todos os useEffects (devem ser sempre executados na mesma ordem)
  
  // Error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // ✅ CORREÇÃO: Filtrar erros de bibliotecas externas minificadas
      const errorSource = event.filename || '';
      const errorMessage = event.message || '';
      
      // Verificar se é erro de código minificado (VM*.js) ou bibliotecas externas
      const isMinifiedCode = errorSource.includes('VM') || 
                            errorSource.includes('js.js') ||
                            errorSource.includes('eval') ||
                            errorSource.includes('Function');
      
      // Verificar se é erro de biblioteca externa conhecida
      const isExternalLibraryError = errorSource.includes('utmify') ||
                                    errorMessage.includes('Cannot read properties of undefined') ||
                                    errorMessage.includes('reading \'forEach\'');
      
      // ✅ OTIMIZAÇÃO: Filtrar erros de recursos do navegador (não são erros críticos do código)
      const isResourceError = errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') ||
                             errorMessage.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                             errorMessage.includes('ERR_NETWORK_CHANGED') ||
                             errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                             errorMessage.includes('Failed to load resource') ||
                             (errorSource.includes('.mp3') && errorMessage.includes('Failed'));
      
      // Suprimir erros de código minificado, bibliotecas externas e recursos do navegador
      if (isMinifiedCode || isExternalLibraryError || isResourceError) {
        event.preventDefault(); // Suprimir o erro
        return;
      }
      
      // Logar outros erros normalmente
      console.error('Erro capturado:', event.error);
    };

    window.addEventListener('error', handleError, true); // Usar capture phase
    return () => window.removeEventListener('error', handleError, true);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    const previousContent = meta.getAttribute('content');
    const adminViewportContent = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

    if (previousContent !== adminViewportContent) {
      meta.setAttribute('content', adminViewportContent);
    }

    return () => {
      if (previousContent === null) {
        meta.removeAttribute('content');
        return;
      }
      meta.setAttribute('content', previousContent);
    };
  }, []);

  // Data-admin attribute (verifica isAuthorized dentro do useEffect)
  useEffect(() => {
    // ✅ Verificar montagem antes de manipular DOM
    if (!isMountedRef.current) return;
    
    try {
      if (isAuthorized) {
        document.body.setAttribute('data-admin', 'true');
      } else {
        document.body.removeAttribute('data-admin');
      }
    } catch (error) {
      // Suprimir erros de manipulação do DOM se o componente foi desmontado
    }
    
    return () => {
      try {
        if (document.body) {
          document.body.removeAttribute('data-admin');
        }
      } catch (error) {
        // Suprimir erros de cleanup
      }
    };
  }, [isAuthorized]);

  useEffect(() => {
    let cancelled = false;
    const win = typeof window === "undefined" ? undefined : (window as any);
    const start = () => {
      if (cancelled) return;
      setNonCriticalEnabled(true);
    };

    if (win && "requestIdleCallback" in win) {
      const id = win.requestIdleCallback(start, { timeout: 2500 });
      return () => {
        cancelled = true;
        if (typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(id);
        }
      };
    }

    const timer = setTimeout(start, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!nonCriticalEnabled) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("e2e_admin") === "true") {
      setShowWeatherWidget(false);
      return;
    }

    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setShowWeatherWidget(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [nonCriticalEnabled]);

  // ✅ PWA: Mostrar notificação de instalação
  useEffect(() => {
    if (shouldShowNotification && isInstallable && !isInstalled && !notificationShownRef.current) {
      notificationShownRef.current = true; // Marcar como exibida
      const notificationId = toast.info(
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-base mb-1">📱 Instalar App Admin</p>
            <p className="text-sm text-muted-foreground">
              Instale o painel administrativo como um app para acesso rápido e melhor experiência.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                toast.dismiss(notificationId);
                const result = await installPWA();
                if (result === true) {
                  toast.success('App instalado com sucesso!');
                  dismissNotification();
                } else if (result && typeof result === 'object' && result.fallback) {
                  // Mostrar instruções de instalação manual melhoradas
                  const isMobile = result.isMobile || false;
                  const steps = result.steps || [];
                  
                  toast.info(
                    <div className="space-y-3 max-w-md">
                      <div>
                        <p className="font-semibold text-base mb-2">
                          {isMobile ? '📱 Instalar no Mobile' : '💻 Instalar no Desktop'}
                        </p>
                        {steps.length > 0 ? (
                          <ol className="space-y-1.5 text-sm list-decimal list-inside">
                            {steps.map((step, idx) => (
                              <li key={idx} className="text-muted-foreground">
                                {step.replace(/^\d+\.\s*/, '')}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {result.instructions}
                          </p>
                        )}
                      </div>
                      {!isMobile && (
                        <p className="text-xs text-muted-foreground italic">
                          💡 Dica: Procure o ícone ➕ na barra de endereços do navegador
                        </p>
                      )}
                    </div>,
                    { 
                      duration: 12000,
                      position: 'top-center',
                      className: 'max-w-md'
                    }
                  );
                } else {
                  toast.error('Não foi possível instalar o app. Tente usar o menu do navegador.');
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Instalar Agora
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast.dismiss(notificationId);
                dismissNotification();
              }}
            >
              Agora não
            </Button>
          </div>
        </div>,
        {
          duration: 20000, // 20 segundos - mais tempo para ler
          position: 'top-center',
          closeButton: true,
          // ✅ Nota: O espaçamento é controlado via CSS global em index.css
        }
      );
    } else {
      // Notificação não será exibida - log removido para reduzir verbosidade
    }
  }, [shouldShowNotification, isInstallable, isInstalled, installPWA, dismissNotification]);

  // Mostrar loader enquanto verifica autenticação ou redireciona
  // ✅ UNIFICADO: Um único loading centralizado
  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background fixed inset-0 z-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            {isCheckingAuth ? 'Verificando permissões...' : 'Redirecionando...'}
          </p>
        </div>
      </div>
    );
  }

  // 5. Return principal
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-[100dvh] flex w-full overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 md:h-16 border-b flex items-center justify-between px-3 md:px-4 sticky top-0 bg-background z-10 flex-shrink-0 relative">
            {/* Esquerda: Menu + Tag de Autorização */}
            <div className="flex items-center gap-2 md:gap-2 flex-shrink-0 z-10">
              <SidebarTrigger
                className="h-9 w-9 md:h-9 md:w-9"
                data-testid="sidebar-trigger"
                aria-label="Abrir/fechar menu"
                title="Abrir/fechar menu"
              />
              {/* Tag de Autorização - Estilo Apple */}
              {userRole && (
                <Badge 
                  variant="outline" 
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200/60 dark:border-blue-800/60 shadow-sm backdrop-blur-sm"
                >
                  {userRole === 'admin' ? (
                    <>
                      <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 tracking-wide uppercase">
                        Administrador
                      </span>
                    </>
                  ) : (
                    <>
                      <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 tracking-wide uppercase">
                        Colaborador
                      </span>
                    </>
                  )}
                </Badge>
              )}
            </div>
            
            {/* Centro: Data, Hora e Clima - Estilo Apple */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center z-0">
              {showWeatherWidget ? (
                <Suspense fallback={null}>
                  <WeatherWidget />
                </Suspense>
              ) : null}
            </div>
            
            {/* Direita: Outros botões */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 z-10">
              {/* ✅ PWA: Indicador de Status Offline/Online */}
              <OfflineIndicator />
              
              {/* ✅ PWA: Botão de instalação no cabeçalho - Melhorado para desktop */}
              {isInstallable && !isInstalled && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const result = await installPWA();
                    if (result === true) {
                      toast.success('App instalado com sucesso!');
                    } else if (result && typeof result === 'object' && result.fallback) {
                      // Mostrar instruções de instalação manual em um dialog mais visível
                      const isMobile = result.isMobile || false;
                      const steps = result.steps || [];
                      
                      toast.info(
                        <div className="space-y-3 max-w-md">
                          <div>
                            <p className="font-semibold text-base mb-2">
                              {isMobile ? '📱 Instalar no Mobile' : '💻 Instalar no Desktop'}
                            </p>
                            {steps.length > 0 ? (
                              <ol className="space-y-1.5 text-sm list-decimal list-inside">
                                {steps.map((step, idx) => (
                                  <li key={idx} className="text-muted-foreground">
                                    {step.replace(/^\d+\.\s*/, '')}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-muted-foreground whitespace-pre-line">
                                {result.instructions}
                              </p>
                            )}
                          </div>
                          {!isMobile && (
                            <p className="text-xs text-muted-foreground italic">
                              💡 Dica: Procure o ícone ➕ na barra de endereços do navegador
                            </p>
                          )}
                        </div>,
                        { 
                          duration: 12000,
                          position: 'top-center',
                          className: 'max-w-md'
                        }
                      );
                    } else {
                      toast.error('Não foi possível instalar o app. Tente usar o menu do navegador.');
                    }
                  }}
                  className="flex items-center gap-1 md:gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-7 md:h-9 px-2 md:px-3"
                >
                  <Download className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden md:inline font-semibold text-xs md:text-sm">Instalar App</span>
                  <span className="md:hidden font-semibold text-xs">Instalar</span>
                </Button>
              )}
              {isInstalled && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground px-1 md:px-2">
                  <Download className="h-3 w-3" />
                  <span className="hidden md:inline">Instalado</span>
                </div>
              )}
              {/* ✅ REFATORAÇÃO: Botão de teste removido em produção */}
              {/* Descomente apenas se necessário para debug */}
              {/* 
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/test/country-detection")}
                className="hidden md:flex"
              >
                <Globe className="h-4 w-4 mr-2" />
                Teste País/Idioma
              </Button>
              */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-7 w-7 md:h-9 md:w-auto md:px-3"
                data-testid="logout-button"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden md:inline text-xs md:text-sm">Sair</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <div className="p-1.5 md:p-3">
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          </main>
          {/* PWA: Prompt de instalação customizado */}
          {nonCriticalEnabled ? (
            <Suspense fallback={null}>
              <InstallPrompt />
            </Suspense>
          ) : null}
        </div>
      </div>
    </SidebarProvider>
  );
}
