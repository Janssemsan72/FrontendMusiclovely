import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Eye, 
  EyeOff, 
  CreditCard, 
  Globe, 
  ShoppingCart, 
  Wallet,
  RefreshCw,
  AlertCircle,
  BarChart3
} from "lucide-react";
import { useDashboardStats, useSunoCredits } from "@/hooks/useAdminData";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const USD_TO_BRL = 5.5;

interface QuizMetrics {
  metric_date: string;
  quizzes_saved: number;
  quizzes_saved_with_session_id: number;
  orders_created: number;
  orders_with_quiz: number;
  orders_without_quiz: number;
  quizzes_lost: number;
  retry_queue_size: number;
  success_rate: number;
  session_id_adoption_rate: number;
}

export function DashboardStatsCards() {
  const navigate = useNavigate();
  const [showRevenue, setShowRevenue] = useState<boolean>(true);
  const [quizMetrics, setQuizMetrics] = useState<{
    ordersWithoutQuiz: number;
    retryQueueSize: number;
    successRate: number;
  } | null>(null);
  
  // ✅ OTIMIZAÇÃO: Usar React Query com cache automático
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: sunoCredits, isLoading: creditsLoading, refetch: refetchCredits } = useSunoCredits();

  // Carregar métricas de quiz
  useEffect(() => {
    const loadQuizMetrics = async () => {
      try {
        // Buscar pedidos sem quiz criados hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        const [ordersWithoutQuizResult, retryQueueResult, metricsResult] = await Promise.all([
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .is('quiz_id', null)
            .gte('created_at', todayStr),
          supabase
            .from('quiz_retry_queue')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'processing']),
          supabase
            .rpc('get_quiz_metrics', {
              start_date: today.toISOString().split('T')[0],
              end_date: today.toISOString().split('T')[0]
            })
        ]);

        const ordersWithoutQuiz = ordersWithoutQuizResult.count || 0;
        const retryQueueSize = retryQueueResult.count || 0;
        const todayMetrics = metricsResult.data?.[0] as QuizMetrics | undefined;
        const successRate = todayMetrics?.success_rate || 0;

        setQuizMetrics({
          ordersWithoutQuiz,
          retryQueueSize,
          successRate
        });
      } catch (error) {
        console.error('Erro ao carregar métricas de quiz:', error);
      }
    };

    loadQuizMetrics();
    // ✅ OTIMIZAÇÃO: Atualizar a cada 15 minutos (reduz Edge Requests)
    const interval = setInterval(loadQuizMetrics, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };
  
  // ✅ OTIMIZAÇÃO: Mostrar skeleton apenas se não houver dados anteriores (primeira carga)
  // Se houver dados em cache, mostrar eles imediatamente
  if (statsLoading && !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="admin-card-compact animate-pulse">
            <CardHeader className="p-1 md:p-2">
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent className="p-1 md:p-2">
              <div className="h-6 bg-muted rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  // ✅ OTIMIZAÇÃO: Se não houver stats ainda, retornar null (não renderizar nada)
  if (!stats) {
    return null;
  }
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
      {/* Receita Total (BRL) */}
      <Card className="admin-card-compact relative overflow-hidden border-2 border-primary/20 hover:shadow-lg transition-shadow bg-gradient-to-br from-primary/5 to-primary/10 z-0 order-1 lg:order-none">
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
        <CardContent className="p-0.5 pt-0 md:p-2 md:pt-0 relative z-10">
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

      {/* Vendas Stripe */}
      <Card className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0 order-3 lg:order-none">
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
            >
              {showRevenue ? (
                <Eye className="h-3 w-3 text-[#635BFF]" />
              ) : (
                <EyeOff className="h-3 w-3 text-[#635BFF]" />
              )}
            </Button>
            <CreditCard className="h-3 w-3 text-[#635BFF] shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
          <div className="text-xl md:text-3xl font-bold text-[#635BFF] select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
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

      {/* Vendas Cakto */}
      <Card className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0 order-5 lg:order-none">
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
        <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
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

      {/* Total de Pedidos */}
      <Card className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow order-2 lg:order-none">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full z-0" />
        <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
          <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Total de Pedidos</CardTitle>
          <ShoppingCart className="h-3 w-3 text-primary shrink-0" />
        </CardHeader>
        <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
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

      {/* Taxa de Conversão */}
      <Card className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow order-4 lg:order-none">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/5 rounded-tr-full z-0" />
        <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
          <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
          <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
        </CardHeader>
        <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
          <div className="text-xl md:text-3xl font-bold text-green-600 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
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
      <Card className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow z-0">
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
            >
              <RefreshCw className={`h-3 w-3 text-purple-600 ${creditsLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Wallet className="h-3 w-3 text-purple-600 shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
          {sunoCredits ? (
            <>
              <div className="text-xl md:text-3xl font-bold text-purple-600 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                {sunoCredits.remaining.toLocaleString('pt-BR')}
              </div>
              <div className="mt-0.5 md:mt-1">
                <span className="text-[9px] md:text-[10px] text-muted-foreground">
                  {sunoCredits.total > 0 ? `${((sunoCredits.remaining / sunoCredits.total) * 100).toFixed(0)}% restante` : '0%'}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xl md:text-3xl font-bold text-purple-600">
              Carregando...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas de Quiz - Card de Alerta */}
      {quizMetrics && (() => {
        const hasQuizAlerts = quizMetrics.ordersWithoutQuiz > 0 || quizMetrics.retryQueueSize > 0;
        return (
          <Card 
            className={`admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow cursor-pointer ${
              hasQuizAlerts ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : ''
            }`}
            onClick={() => navigate('/admin/quiz-metrics')}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full z-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
              <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">
                Métricas de Quiz
              </CardTitle>
              {hasQuizAlerts ? (
                <AlertCircle className="h-3 w-3 text-orange-600 shrink-0" />
              ) : (
                <BarChart3 className="h-3 w-3 text-primary shrink-0" />
              )}
            </CardHeader>
            <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
              <div className="text-lg md:text-2xl font-bold">
                {quizMetrics.successRate.toFixed(1)}%
              </div>
              <div className="flex flex-col gap-0.5 mt-0.5 md:mt-1">
                {quizMetrics.ordersWithoutQuiz > 0 && (
                  <div className="inline-block px-1 py-0.5 rounded-md bg-orange-100 border border-orange-200 text-orange-800 text-[8px] md:text-[10px] font-medium">
                    {quizMetrics.ordersWithoutQuiz} pedido(s) sem quiz
                  </div>
                )}
                {quizMetrics.retryQueueSize > 0 && (
                  <div className="inline-block px-1 py-0.5 rounded-md bg-yellow-100 border border-yellow-200 text-yellow-800 text-[8px] md:text-[10px] font-medium">
                    {quizMetrics.retryQueueSize} na fila de retry
                  </div>
                )}
                {!hasQuizAlerts && (
                  <div className="text-[8px] md:text-[10px] text-muted-foreground">
                    Tudo funcionando bem
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}




