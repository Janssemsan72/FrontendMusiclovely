import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStats, useSunoCredits } from "@/hooks/useAdminData";
import { queryClient, invalidateQueries } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { 
  RefreshCw, 
  Music, 
  TrendingUp,
  AlertCircle,
  CreditCard,
  Globe,
  ShoppingCart,
  Eye,
  EyeOff,
  Wallet
} from "lucide-react";

interface DashboardStats {
  totalOrders: number;
  paidOrders: number;
  totalRevenueBRL: number;
  totalRevenueUSD: number;
  totalRevenueBRLConverted: number;
  activeSongs: number;
  pendingJobs: number;
  failedJobs: number;
  stripeOrders: number;
  caktoOrders: number;
  stripeRevenue: number;
  caktoRevenue: number;
}

interface Job {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  error?: string;
  gpt_lyrics?: any;
  suno_task_id?: string;
  orders?: {
    customer_email: string;
    plan: string;
    status?: string; // ✅ CORREÇÃO: Adicionar status do pedido
    paid_at?: string; // ✅ CORREÇÃO: Adicionar paid_at do pedido
    created_at?: string; // ✅ CORREÇÃO: Adicionar created_at do pedido
  };
}

interface Song {
  id: string;
  title: string;
  status: string;
  release_at: string;
  created_at: string;
  audio_url?: string;
  orders?: {
    customer_email: string;
  };
}

// Interface SalesData importada de useAdminData.ts

// Taxa de conversão USD -> BRL (pode ser atualizada via API real)
const USD_TO_BRL = 5.5;

const AdminDashboardJobsTab = lazyWithRetry(() =>
  import("@/components/admin/dashboard/AdminDashboardJobsTab").then((m) => ({
    default: m.AdminDashboardJobsTab,
  }))
);
const AdminDashboardSongsTab = lazyWithRetry(() =>
  import("@/components/admin/dashboard/AdminDashboardSongsTab").then((m) => ({
    default: m.AdminDashboardSongsTab,
  }))
);

export default function AdminDashboard() {
  // ✅ Declarar estados antes de usar nos hooks
  // ✅ OTIMIZAÇÃO: Usar hooks do React Query que já existem
  const [statsEnabled, setStatsEnabled] = useState(false);
  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats({ enabled: statsEnabled });
  const { data: sunoCreditsData, isLoading: creditsLoading, refetch: refetchCredits } = useSunoCredits();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"jobs" | "songs">("jobs");
  
  // Ref para debounce das atualizações do realtime
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showRevenue, setShowRevenue] = useState<boolean>(true);
  const hasLoadedSongsRef = useRef(false);
  
  // ✅ OTIMIZAÇÃO: Usar dados dos hooks
  // ✅ CORREÇÃO: Retornar null quando não há dados para não mostrar cards zerados
  const stats: DashboardStats | null = dashboardStats ? {
    totalOrders: dashboardStats.totalOrders,
    paidOrders: dashboardStats.paidOrders,
    totalRevenueBRL: dashboardStats.totalRevenueBRL,
    totalRevenueUSD: dashboardStats.totalRevenueUSD,
    totalRevenueBRLConverted: dashboardStats.totalRevenueBRLConverted,
    activeSongs: 0, // Será carregado separadamente
    pendingJobs: 0, // Será carregado separadamente
    failedJobs: 0, // Será carregado separadamente
    stripeOrders: dashboardStats.stripeOrders,
    caktoOrders: dashboardStats.caktoOrders,
    stripeRevenue: dashboardStats.stripeRevenue,
    caktoRevenue: dashboardStats.caktoRevenue,
  } : null;
  
  const sunoCredits = sunoCreditsData || { total: 92750, used: 0, remaining: 92750 };
  
  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };
  
  const loadRecentJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const jobsResult = await supabase
        .from("jobs")
        .select("id, order_id, status, created_at, updated_at, error, suno_task_id, orders:order_id(customer_email, plan, status, paid_at, created_at)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (jobsResult.data) setJobs(jobsResult.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadRecentSongs = useCallback(async () => {
    try {
      setSongsLoading(true);
      const songsResult = await supabase
        .from("songs")
        .select("id, order_id, title, status, release_at, created_at, orders:order_id(customer_email)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (songsResult.data) setSongs(songsResult.data);
      hasLoadedSongsRef.current = true;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setSongsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      // ✅ CORREÇÃO: Limpar cache do dashboard antes de refetch para garantir dados atualizados
      await invalidateQueries.dashboard();
      const tasks: PromiseSettledResult<unknown>[] = await Promise.allSettled([
        statsEnabled ? refetchStats() : Promise.resolve(),
        refetchCredits(),
        loadRecentJobs(),
        hasLoadedSongsRef.current ? loadRecentSongs() : Promise.resolve(),
      ]);
      void tasks;
    } finally {
      setRefreshing(false);
    }
  }, [loadRecentJobs, loadRecentSongs, refetchCredits, refetchStats, statsEnabled]);

  useEffect(() => {
    const win = typeof window === "undefined" ? undefined : (window as any);
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      setStatsEnabled(true);
    };

    if (win && "requestIdleCallback" in win) {
      const id = win.requestIdleCallback(start, { timeout: 2000 });
      return () => {
        cancelled = true;
        if (typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(id);
        }
      };
    }

    const timer = setTimeout(start, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Carregar dados leves em background (não bloquear render)
    // Stats e créditos já são carregados pelos hooks do React Query
    // Usar setTimeout para não bloquear render inicial dos cards
    setTimeout(() => {
      loadRecentJobs();
    }, 300); // Aguardar 300ms para não bloquear render inicial
    
    // ✅ OTIMIZAÇÃO: Função para atualizar com debounce usando hooks do React Query
    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        if (statsEnabled) {
          refetchStats();
        }
        refetchCredits();
      }, 2000); // Aguardar 2 segundos antes de atualizar (debounce)
    };
    
    // ✅ CORREÇÃO ERRO 401: Verificar autenticação antes de criar subscription
    let channel: any = null;
    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // Não criar subscription se não autenticado

        channel = supabase
          .channel('admin-dashboard-realtime', {
            config: {
              broadcast: { self: true },
              presence: { key: 'admin-dashboard' }
            }
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'orders'
          }, (payload) => {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            // ✅ Verificar se status mudou para 'paid' ou 'refunded'
            if (newStatus === 'paid' && oldStatus !== 'paid') {
              debouncedUpdate();
            } else if (newStatus === 'refunded' && oldStatus !== 'refunded') {
              debouncedUpdate();
            }
          })
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'orders'
          }, (payload) => {
            // ✅ Verificar se novo pedido foi criado com status 'paid'
            if (payload.new?.status === 'paid') {
              // Recarregar dados do dashboard com debounce
              debouncedUpdate();
            }
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'suno_credits' 
          }, () => {
            // ✅ OTIMIZAÇÃO: Créditos são atualizados automaticamente pelo hook useSunoCredits
            // O hook tem refetchInterval configurado
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Erro na subscription realtime');
            } else if (status === 'TIMED_OUT') {
              console.error('Timeout na subscription realtime');
            }
          });
      } catch (error) {
        // Erro ao verificar autenticação ou criar subscription
        // Não fazer nada - a página continuará funcionando sem Realtime
      }
    };

    setupRealtime();
    
    // ✅ OTIMIZAÇÃO: Desabilitar realtime quando página não está visível (reduz Edge Requests)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página não visível - remover subscription temporariamente
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      } else {
        // Página visível novamente - recriar subscription
        if (!channel) {
          setupRealtime();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ✅ OTIMIZAÇÃO: Hooks do React Query já têm refetchInterval configurado
    // Não precisamos de interval manual
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadRecentJobs, refetchStats, refetchCredits, statsEnabled]);

  useEffect(() => {
    if (activeTab !== "songs") return;
    if (hasLoadedSongsRef.current) return;
    void loadRecentSongs();
  }, [activeTab, loadRecentSongs]);

  const retryJob = async (jobId: string) => {
    try {
      setRetryingJob(jobId);
      toast.info("Retentando job...");

      // ✅ CORREÇÃO: Usar generate-lyrics-internal (Anthropic Claude) em vez de generate-lyrics (Lovable)
      const { error } = await supabase.functions.invoke("generate-lyrics-internal", {
        body: { job_id: jobId }
      });

      if (error) throw error;

      toast.success("Job reenviado com sucesso!");
      refetchStats();
      await loadRecentJobs();
    } catch (error: any) {
      console.error("Erro ao retentar job:", error);
      toast.error("Erro ao retentar job");
    } finally {
      setRetryingJob(null);
    }
  };


  // ✅ OTIMIZAÇÃO: Não bloquear renderização - mostrar skeleton/loading inline
  const isLoading = statsLoading && !dashboardStats;
  const statsCardTestIds = [
    'stats-card-total-revenue',
    'stats-card-stripe',
    'stats-card-cakto',
    'stats-card-total-orders',
    'stats-card-conversion',
    'stats-card-suno-credits',
  ];
  const statsCardLabels: Record<string, string> = {
    'stats-card-total-revenue': 'Receita total',
    'stats-card-stripe': 'Vendas Stripe',
    'stats-card-cakto': 'Vendas Cakto',
    'stats-card-total-orders': 'Total de pedidos',
    'stats-card-conversion': 'Taxa de conversão',
    'stats-card-suno-credits': 'Créditos Suno',
  };

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dashboard Administrativo
          </h1>
          <h2 className="sr-only">Resumo</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Visão geral do sistema e vendas</p>
        </div>
        <Button 
          onClick={refreshDashboard}
          variant="outline" 
          size="sm"
          disabled={refreshing}
          aria-label="Atualizar dados do dashboard"
          title="Atualizar dados do dashboard"
        >
          <RefreshCw className={`h-4 w-4 md:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {/* Stats Cards - Mobile: 2 colunas verticais | Desktop: 2 grupos de 3 cards */}
      {/* Mobile: Coluna esquerda (com detalhes) | Coluna direita (sem detalhes) */}
      {/* ✅ OTIMIZAÇÃO: Mostrar skeleton enquanto carrega, ou cards se houver dados */}
      {statsLoading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {statsCardTestIds.map((testId) => (
            <Card
              key={testId}
              data-testid={testId}
              role="region"
              aria-label={statsCardLabels[testId] ?? 'Indicador'}
              className="admin-card-compact animate-pulse"
            >
              <CardHeader className="p-1 md:p-2">
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="p-1 md:p-2">
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4" style={{ gridAutoRows: '1fr' }}>
        {/* Coluna Esquerda - Cards com detalhes nas bordas */}
        {/* Receita Total (BRL) - Com detalhe - order-1 no mobile */}
        <Card data-testid="stats-card-total-revenue" role="region" aria-label="Receita total" className="admin-card-compact relative overflow-hidden border-2 border-primary/20 hover:shadow-lg transition-shadow bg-gradient-to-br from-primary/5 to-primary/10 z-0 order-1 lg:order-none h-full flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full z-0" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-0.5 md:p-2 relative z-10">
            <CardTitle className="text-[9px] md:text-xs font-medium">Receita Total</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setShowRevenue(!showRevenue)}
                title={showRevenue ? "Ocultar valores" : "Mostrar valores"}
                aria-label={showRevenue ? "Ocultar valores" : "Mostrar valores"}
              >
                {showRevenue ? (
                  <Eye className="h-3 w-3 text-primary" />
                ) : (
                  <EyeOff className="h-3 w-3 text-primary" />
                )}
              </Button>
              <TrendingUp className="h-3 w-3 text-primary shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-0.5 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-lg md:text-3xl font-bold text-primary select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {showRevenue ? (
                `R$ ${(stats.totalRevenueBRLConverted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              ) : (
                'R$ •••••••'
              )}
            </div>
            <div className="mt-0.5 md:mt-1">
              <div className="inline-block px-1 py-0.5 md:px-1.5 md:py-0.5 rounded-md bg-[#f0f9f4] border border-[#c6e6d0] text-gray-900 text-[8px] md:text-[10px] font-medium">
                {stats.paidOrders} pedidos
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Stripe - Com detalhe - order-3 no mobile */}
        <Card data-testid="stats-card-stripe" role="region" aria-label="Vendas Stripe" className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0 order-3 lg:order-none h-full flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#635BFF]/5 rounded-bl-full z-0" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#635BFF]/5 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Stripe (USD)</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setShowRevenue(!showRevenue)}
                title={showRevenue ? "Ocultar valores" : "Mostrar valores"}
                aria-label={showRevenue ? "Ocultar valores" : "Mostrar valores"}
              >
                {showRevenue ? (
                  <Eye className="h-3 w-3 text-indigo-700" />
                ) : (
                  <EyeOff className="h-3 w-3 text-indigo-700" />
                )}
              </Button>
              <CreditCard className="h-3 w-3 text-indigo-700 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-xl md:text-3xl font-bold text-indigo-700 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {showRevenue ? (
                `$${(stats.stripeRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              ) : (
                '$•••••'
              )}
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-0.5 md:gap-1.5 mt-0.5 md:mt-1">
              <div className="inline-block px-1.5 py-0.5 rounded-md bg-[#f0f9f4] border border-[#c6e6d0] text-gray-900 text-[9px] md:text-[10px] font-medium">
                {stats.stripeOrders || 0} pedidos
              </div>
              <span className="text-[9px] md:text-[10px] text-muted-foreground">
                ≈ R$ {((stats.stripeRevenue || 0) * USD_TO_BRL).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Cakto - Com detalhe - order-5 no mobile */}
        <Card data-testid="stats-card-cakto" role="region" aria-label="Vendas Cakto" className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0 order-5 lg:order-none h-full flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00C853]/5 rounded-bl-full z-0" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00C853]/5 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Cakto (BRL)</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setShowRevenue(!showRevenue)}
                title={showRevenue ? "Ocultar valores" : "Mostrar valores"}
                aria-label={showRevenue ? "Ocultar valores" : "Mostrar valores"}
              >
                {showRevenue ? (
                  <Eye className="h-3 w-3 text-[#00C853]" />
                ) : (
                  <EyeOff className="h-3 w-3 text-[#00C853]" />
                )}
              </Button>
              <Globe className="h-3 w-3 text-[#00C853] shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-xl md:text-3xl font-bold text-[#00C853] select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {showRevenue ? (
                `R$ ${(stats.caktoRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              ) : (
                'R$ ••••••'
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
              <div className="inline-block px-1.5 py-0.5 rounded-md bg-[#f0f9f4] border border-[#c6e6d0] text-gray-900 text-[9px] md:text-[10px] font-medium">
                {stats.caktoOrders} pedidos
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna Direita - Cards sem detalhes nas bordas */}
        {/* Total de Pedidos - Sem detalhe - order-2 no mobile */}
        <Card data-testid="stats-card-total-orders" role="region" aria-label="Total de pedidos" className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow order-2 lg:order-none h-full flex flex-col">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-3 w-3 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-xl md:text-3xl font-bold select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {stats.totalOrders}
            </div>
            <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
              <div className="inline-block px-1.5 py-0.5 rounded-md bg-[#f0f9f4] border border-[#c6e6d0] text-gray-900 text-[9px] md:text-[10px] font-medium">
                {stats.paidOrders} pagos
              </div>
              <span className="text-[9px] md:text-[10px] text-muted-foreground">
                {stats.paidOrders > 0 ? `${((stats.paidOrders / stats.totalOrders) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conversão - Sem detalhe - order-4 no mobile */}
        <Card data-testid="stats-card-conversion" role="region" aria-label="Taxa de conversão" className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow order-4 lg:order-none h-full flex flex-col">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/5 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-xl md:text-3xl font-bold text-green-700 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {stats.totalOrders > 0 ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1) : '0'}%
            </div>
            <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
              <div className="inline-block px-1.5 py-0.5 rounded-md bg-[#f0f9f4] border border-[#c6e6d0] text-gray-900 text-[9px] md:text-[10px] font-medium">
                {stats.paidOrders} pedidos
              </div>
              <span className="text-[9px] md:text-[10px] text-muted-foreground">
                de {stats.totalOrders} pedidos
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Créditos Suno */}
        <Card data-testid="stats-card-suno-credits" role="region" aria-label="Créditos Suno" className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0 h-full flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-full z-0" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-tr-full z-0" />
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Créditos Suno</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => refetchCredits()}
                disabled={creditsLoading}
                title="Atualizar créditos"
                aria-label="Atualizar créditos"
              >
                <RefreshCw className={`h-3 w-3 text-purple-600 ${creditsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Wallet className="h-3 w-3 text-purple-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 flex-1 flex flex-col justify-between">
            <div className="text-xl md:text-3xl font-bold text-purple-600 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
              {sunoCredits.remaining.toLocaleString('pt-BR')}
            </div>
            <div className="mt-0.5 md:mt-1">
              <span className="text-[9px] md:text-[10px] text-muted-foreground">
                {sunoCredits.total > 0 ? `${((sunoCredits.remaining / sunoCredits.total) * 100).toFixed(0)}% restante` : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {statsCardTestIds.map((testId) => (
            <Card
              key={testId}
              data-testid={testId}
              role="region"
              aria-label={statsCardLabels[testId] ?? 'Indicador'}
              className="admin-card-compact animate-pulse"
            >
              <CardHeader className="p-1 md:p-2">
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="p-1 md:p-2">
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "jobs" | "songs")} className="space-y-2 md:space-y-6">
        <TabsList className="admin-tabs-marrom grid w-full grid-cols-2 lg:w-auto lg:inline-grid h-auto">
          <TabsTrigger value="jobs" data-testid="tab-jobs" className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="songs" data-testid="tab-songs" className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <Music className="h-3 w-3 md:h-4 md:w-4" />
            Músicas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" data-testid="jobs-content" className="space-y-2 md:space-y-4">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Carregando...
              </div>
            }
          >
            <AdminDashboardJobsTab
              jobs={jobs}
              jobsLoading={jobsLoading}
              retryingJob={retryingJob}
              onRetryJob={retryJob}
              onCopyToClipboard={copyToClipboard}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="songs" data-testid="songs-content" className="space-y-4">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Carregando...
              </div>
            }
          >
            <AdminDashboardSongsTab songs={songs} songsLoading={songsLoading} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
