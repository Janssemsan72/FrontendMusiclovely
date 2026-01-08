import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Search, 
  Eye, 
  DollarSign, 
  CreditCard, 
  TrendingUp,
  Calendar,
  Filter,
  Download
} from "lucide-react";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { usePayments } from "@/hooks/useAdminData";

interface Payment {
  id: string;
  order_id: string;
  status: string;
  plan: string;
  amount_cents: number;
  provider: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  paid_at?: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminPayments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // ✅ OTIMIZAÇÃO: Usar React Query para cache automático
  const { data: paymentsData, isLoading: loading, refetch } = usePayments({
    search: searchTerm,
    status: statusFilter,
    plan: planFilter,
    provider: providerFilter,
    dateFilter,
  });
  
  const payments = useMemo(() => {
    if (!paymentsData) return [];
    return paymentsData.map((order: any) => ({
      id: order.id,
      order_id: order.id,
      status: order.status,
      plan: order.plan,
      amount_cents: order.amount_cents,
      provider: order.provider || order.payment_provider || 'cakto',
      stripe_checkout_session_id: order.stripe_checkout_session_id,
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      created_at: order.created_at,
      paid_at: order.paid_at,
      user_email: Array.isArray(order.profiles) ? order.profiles[0]?.email : order.profiles?.email,
      user_name: Array.isArray(order.profiles) ? order.profiles[0]?.display_name : order.profiles?.display_name,
    }));
  }, [paymentsData]);
  
  const stats = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        pendingPayments: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        monthlyRevenue: 0,
      };
    }
    
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const totalTransactions = paidPayments.length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const conversionRate = payments.length > 0 ? (paidPayments.length / payments.length) * 100 : 0;
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    // Receita do mês atual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = paidPayments
      .filter(p => p.paid_at && new Date(p.paid_at) >= monthStart)
      .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    
    return {
      totalRevenue,
      totalTransactions,
      pendingPayments,
      conversionRate,
      averageOrderValue,
      monthlyRevenue,
    };
  }, [payments]);

  const paymentsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [payments, searchTerm, statusFilter, planFilter, providerFilter, dateFilter]);

  const filteredPayments = useMemo((): Payment[] => {
    let filtered = payments;

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.stripe_payment_intent_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de status
    if (statusFilter !== "all") {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    // Filtro de plano
    if (planFilter !== "all") {
      filtered = filtered.filter(payment => payment.plan === planFilter);
    }

    // Filtro de provedor
    if (providerFilter !== "all") {
      filtered = filtered.filter(payment => payment.provider === providerFilter);
    }

    // Filtro de data
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.created_at);
        return paymentDate >= filterDate;
      });
    }

    return filtered;
  }, [payments, searchTerm, statusFilter, planFilter, providerFilter, dateFilter]);

  const formatCurrency = (cents: number, currency: string = 'BRL') => {
    const amount = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      stripe: "bg-blue-100 text-blue-800",
      mercadopago: "bg-green-100 text-green-800"
    };
    
    return (
      <Badge className={colors[provider as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {provider.toUpperCase()}
      </Badge>
    );
  };

  const exportPayments = () => {
    const csvContent = [
      ['ID', 'Status', 'Plano', 'Valor', 'Provedor', 'Email', 'Data Criação', 'Data Pagamento'].join(','),
      ...filteredPayments.map(payment => [
        payment.order_id,
        payment.status,
        payment.plan,
        payment.amount_cents / 100,
        payment.provider,
        payment.user_email || '',
        payment.created_at,
        payment.paid_at || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
  const startIndex = (currentPage - 1) * paymentsPerPage;
  const endIndex = startIndex + paymentsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Pagamentos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie todos os pagamentos do sistema
          </p>
        </div>
      <div className="flex gap-2">
          <Button onClick={exportPayments} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTransactions} transações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.monthlyRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos aprovados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.pendingPayments}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="ID, email, nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-14"
                  style={{ paddingLeft: '3.5rem' }}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Plano</label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Provedor</label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Pagamentos ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Plano</th>
                  <th className="text-left p-2">Valor</th>
                  <th className="text-left p-2">Provedor</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono text-sm">
                      {payment.order_id.slice(0, 8)}...
                    </td>
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{payment.user_name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.user_email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <OrderStatusBadge status={payment.status} />
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">
                        {payment.plan}
                      </Badge>
                    </td>
                    <td className="p-2 font-medium">
                      {formatCurrency(payment.amount_cents)}
                    </td>
                    <td className="p-2">
                      {getProviderBadge(payment.provider)}
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      <div>{formatDate(payment.created_at)}</div>
                      {payment.paid_at && (
                        <div className="text-green-600">
                          Pago: {formatDate(payment.paid_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12 md:py-16">
              <CreditCard className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm md:text-base font-medium mb-2">
                Nenhum pagamento encontrado
              </p>
              <p className="text-muted-foreground text-xs md:text-sm">
                {searchTerm || statusFilter !== "all" || planFilter !== "all" || providerFilter !== "all" || dateFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Quando houver pagamentos, eles aparecerão aqui"}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPayments.length)} de {filteredPayments.length} pagamentos
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="px-3 py-1 text-sm">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
