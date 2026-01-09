import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileQuestion,
  ShoppingCart,
  Clock,
  Database
} from "lucide-react";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

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

interface AggregatedMetrics {
  total_quizzes_saved: number;
  total_orders_created: number;
  total_orders_with_quiz: number;
  total_orders_without_quiz: number;
  overall_success_rate: number;
}

export default function AdminQuizMetrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<QuizMetrics[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedMetrics | null>(null);
  const [period, setPeriod] = useState<{ start_date: string; end_date: string } | null>(null);
  const [daysRange, setDaysRange] = useState<string>("30");

  const loadMetrics = async (days: string = "30") => {
    try {
      setLoading(true);
      setError(null); // Limpar erro anterior
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Chamar edge function via URL com query params (GET method)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL não configurada');
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-quiz-metrics?start_date=${startDateStr}&end_date=${endDateStr}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      );

      if (!response.ok) {
        // ✅ CORREÇÃO: Melhor tratamento de erros HTTP
        if (response.status === 404) {
          throw new Error('Edge function "get-quiz-metrics" não encontrada. Verifique se ela foi deployada no Supabase.');
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Não autorizado. Verifique suas permissões de acesso.');
        } else {
          const errorText = await response.text();
          throw new Error(`Erro HTTP ${response.status}: ${errorText || response.statusText}`);
        }
      }

      const data = await response.json();
      
      // ✅ CORREÇÃO: Verificar se há erro na resposta
      if (data.error) {
        throw new Error(data.error || 'Erro desconhecido ao carregar métricas');
      }

      if (data?.success) {
        setMetrics(data.daily_metrics || []);
        setAggregated(data.aggregated || null);
        setPeriod(data.period || null);
        setError(null); // Limpar erro se sucesso
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar métricas:', error);
      const errorMessage = error.message || 'Erro desconhecido ao carregar métricas';
      setError(errorMessage);
      toast.error(errorMessage);
      // Limpar dados em caso de erro
      setMetrics([]);
      setAggregated(null);
      setPeriod(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics(daysRange);
  }, [daysRange]);

  if (loading) {
    return <AdminPageLoading text="Carregando métricas..." />;
  }

  // ✅ CORREÇÃO: Mostrar erro na UI
  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Métricas de Quiz</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoramento de salvamento de quizzes e criação de pedidos
            </p>
          </div>
          <Button onClick={() => loadMetrics(daysRange)} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
        
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro ao carregar métricas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">
              {error}
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Possíveis causas:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Edge function "get-quiz-metrics" não foi deployada no Supabase</li>
                <li>Problema de conexão com o Supabase</li>
                <li>Falta de permissões de acesso</li>
                <li>Variável de ambiente VITE_SUPABASE_URL não configurada</li>
              </ul>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => loadMetrics(daysRange)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
              <Button 
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')} 
                variant="outline"
              >
                <Database className="h-4 w-4 mr-2" />
                Verificar Supabase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Preparar dados para gráficos
  const chartData = metrics.map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    'Quizzes Salvos': m.quizzes_saved,
    'Pedidos Criados': m.orders_created,
    'Pedidos com Quiz': m.orders_with_quiz,
    'Pedidos sem Quiz': m.orders_without_quiz,
    'Taxa de Sucesso (%)': m.success_rate,
    'Fila de Retry': m.retry_queue_size
  }));

  const successRateData = metrics.map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    'Taxa de Sucesso (%)': m.success_rate,
    'Adoção session_id (%)': m.session_id_adoption_rate
  }));

  const hasAlerts = aggregated && (
    aggregated.total_orders_without_quiz > 0 ||
    (metrics.length > 0 && metrics[metrics.length - 1].retry_queue_size > 10)
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Métricas de Quiz</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento de salvamento de quizzes e criação de pedidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={daysRange} onValueChange={setDaysRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => loadMetrics(daysRange)} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {hasAlerts && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Alertas</h3>
                <ul className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                  {aggregated && aggregated.total_orders_without_quiz > 0 && (
                    <li>
                      ⚠️ <strong>{aggregated.total_orders_without_quiz}</strong> pedido(s) sem quiz vinculado
                    </li>
                  )}
                  {metrics.length > 0 && metrics[metrics.length - 1].retry_queue_size > 10 && (
                    <li>
                      ⚠️ Fila de retry com <strong>{metrics[metrics.length - 1].retry_queue_size}</strong> itens pendentes
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quizzes Salvos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated?.total_quizzes_saved || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Criados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated?.total_orders_created || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregated?.overall_success_rate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos com quiz / Total
            </p>
          </CardContent>
        </Card>

        <Card className={aggregated && aggregated.total_orders_without_quiz > 0 ? "border-orange-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos sem Quiz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${aggregated && aggregated.total_orders_without_quiz > 0 ? "text-orange-600" : ""}`}>
              {aggregated?.total_orders_without_quiz || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requer atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendências */}
      <Card>
        <CardHeader>
          <CardTitle>Tendências Diárias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Quizzes Salvos" stroke="#8884d8" />
              <Line type="monotone" dataKey="Pedidos Criados" stroke="#82ca9d" />
              <Line type="monotone" dataKey="Pedidos com Quiz" stroke="#ffc658" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Taxa de Sucesso */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Sucesso e Adoção de session_id</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={successRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Taxa de Sucesso (%)" stroke="#10b981" />
              <Line type="monotone" dataKey="Adoção session_id (%)" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Pedidos com/sem Quiz */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos com e sem Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Pedidos com Quiz" fill="#10b981" />
              <Bar dataKey="Pedidos sem Quiz" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes Diários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Data</th>
                  <th className="text-right p-2">Quizzes</th>
                  <th className="text-right p-2">Com session_id</th>
                  <th className="text-right p-2">Pedidos</th>
                  <th className="text-right p-2">Com Quiz</th>
                  <th className="text-right p-2">Sem Quiz</th>
                  <th className="text-right p-2">Taxa (%)</th>
                  <th className="text-right p-2">Fila Retry</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      {new Date(metric.metric_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="text-right p-2">{metric.quizzes_saved}</td>
                    <td className="text-right p-2">{metric.quizzes_saved_with_session_id}</td>
                    <td className="text-right p-2">{metric.orders_created}</td>
                    <td className="text-right p-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {metric.orders_with_quiz}
                      </Badge>
                    </td>
                    <td className="text-right p-2">
                      {metric.orders_without_quiz > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          {metric.orders_without_quiz}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-right p-2">
                      <span className={metric.success_rate >= 95 ? "text-green-600 font-semibold" : metric.success_rate >= 80 ? "text-yellow-600" : "text-red-600"}>
                        {metric.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right p-2">
                      {metric.retry_queue_size > 0 ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {metric.retry_queue_size}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

