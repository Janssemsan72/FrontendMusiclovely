import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, DollarSign, TestTube, CheckCircle, Phone, Clock, ShoppingCart } from "lucide-react";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import { useOrders, useOrdersStats } from "@/hooks/useAdminData";
import { useDebounce } from "@/hooks/use-debounce";
import { useCollaboratorPermissions } from "@/hooks/useCollaboratorPermissions";

interface Order {
  id: string;
  customer_email: string;
  customer_whatsapp?: string;
  status: string;
  plan: string;
  amount_cents: number;
  created_at: string;
  paid_at?: string;
  provider: string;
  is_test_order?: boolean;
  customer_name?: string;
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showTestOrders, setShowTestOrders] = useState(false);
  const [convertingOrder, setConvertingOrder] = useState<string | null>(null);
  const ordersPerPage = 50; // ✅ Aumentado para melhor performance
  
  // ✅ CORREÇÃO: Normalizar role para evitar variações (ex: "colaborador")
  const normalizeRole = (role: string | null): 'admin' | 'collaborator' | null => {
    if (!role) return null;
    const normalized = role.toLowerCase().trim();
    if (normalized === 'admin') return 'admin';
    if (normalized === 'collaborator' || normalized === 'colaborador') return 'collaborator';
    return null;
  };
  
  // ✅ CORREÇÃO: Verificar localStorage de forma SÍNCRONA antes de renderizar (evita flash)
  // Isso garante que a verificação aconteça ANTES do primeiro render
  const getInitialRole = (): 'admin' | 'collaborator' | null => {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem('user_role');
    return normalizeRole(role);
  };
  
  const [initialRole] = useState<'admin' | 'collaborator' | null>(getInitialRole());
  const { userRole, isLoading: isRoleLoading } = useCollaboratorPermissions();
  const [cachedRole, setCachedRole] = useState<'admin' | 'collaborator' | null>(initialRole);
  // ✅ CORREÇÃO: Inicializar roleVerified como false e só marcar como true quando tivermos certeza
  const [roleVerified, setRoleVerified] = useState(false);
  
  // ✅ CORREÇÃO: Verificar role imediatamente e marcar como verificado APENAS quando tivermos certeza
  useEffect(() => {
    // Verificar imediatamente
    const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
    const normalizedRole = normalizeRole(role);
    setCachedRole(normalizedRole);
    
    // Só marcar como verificado se tivermos uma role válida OU se o hook já tiver retornado
    if (role || (!isRoleLoading && userRole)) {
      setRoleVerified(true);
      
      // Adicionar atributo data no body para CSS global
      if (typeof document !== 'undefined') {
        const finalRole = normalizedRole || userRole;
        if (finalRole) {
          document.body.setAttribute('data-user-role', finalRole);
        }
      }
    }
  }, [isRoleLoading, userRole]);
  
  // Monitorar mudanças no localStorage
  useEffect(() => {
    const checkRole = () => {
      const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
      const normalizedRole = normalizeRole(role);
      setCachedRole(normalizedRole);
      
      // Atualizar atributo no body
      if (typeof document !== 'undefined' && normalizedRole) {
        document.body.setAttribute('data-user-role', normalizedRole);
      }
    };
    
    // Verificar imediatamente
    checkRole();
    
    // Escutar mudanças no localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_role') {
        const normalizedRole = normalizeRole(e.newValue);
        setCachedRole(normalizedRole);
        if (typeof document !== 'undefined' && normalizedRole) {
          document.body.setAttribute('data-user-role', normalizedRole);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Verificar periodicamente (fallback para mudanças na mesma aba)
    const interval = setInterval(checkRole, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // ✅ CORREÇÃO: Verificação mais conservadora - se houver QUALQUER indicação de colaborador, ocultar
  // Só mostrar o card se tivermos CERTEZA ABSOLUTA de que é admin
  // Verificação DIRETA no momento do cálculo (não depende de estado)
  const getCurrentRole = (): 'admin' | 'collaborator' | null => {
    if (typeof window !== 'undefined') {
      return normalizeRole(localStorage.getItem('user_role'));
    }
    return null;
  };
  
  const currentRole = getCurrentRole();
  // ✅ VERIFICAÇÃO DEFINITIVA: Se QUALQUER fonte indicar colaborador, considerar como colaborador
  const isCollaborator = 
    currentRole === 'collaborator' ||
    initialRole === 'collaborator' || 
    userRole === 'collaborator' || 
    cachedRole === 'collaborator';
  
  // ✅ CORREÇÃO: Calcular cards que devem ser mostrados usando useMemo
  // Isso garante que o card "Pago" nunca seja incluído se for colaborador
  const cardsToShow = useMemo(() => {
    const cards = [
      'total', // Total de Pedidos - sempre mostra
      'pago',  // Pago - só se NÃO for colaborador
      'pendentes', // Pendentes - sempre mostra
      'conversao' // Conversão - sempre mostra
    ];
    
    // Se for colaborador, remover 'pago' do array
    if (isCollaborator) {
      return cards.filter(card => card !== 'pago');
    }
    
    return cards;
  }, [isCollaborator]);
  
  // Debug: verificar role
  
  // ✅ OTIMIZAÇÃO: Usar React Query com paginação real
  // ✅ BUSCA EM BACKGROUND: Manter dados anteriores visíveis durante busca
  const { data: ordersData, isLoading: loading, refetch, isFetching, error: ordersError } = useOrders({
    search: debouncedSearchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    plan: planFilter !== "all" ? planFilter : undefined,
    provider: providerFilter !== "all" ? providerFilter : undefined,
    page: currentPage,
    pageSize: ordersPerPage,
  });
  
  // ✅ NOVO: Buscar estatísticas reais (contagens agregadas) sem carregar todos os dados
  const { data: statsData, isLoading: statsLoading } = useOrdersStats({
    search: debouncedSearchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    plan: planFilter !== "all" ? planFilter : undefined,
    provider: providerFilter !== "all" ? providerFilter : undefined,
  });
  
  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.total || orders.length;
  
  
  // ✅ Tratamento de erros
  useEffect(() => {
    if (ordersError) {
      console.error("Erro ao carregar pedidos:", ordersError);
      toast.error("Erro ao carregar pedidos. Verifique o console para mais detalhes.");
    }
  }, [ordersError]);

  // Função para formatar telefone: +55 41 99898-2514
  const formatPhone = (phone: string): string => {
    const numbers = phone.replace(/\D/g, '');
    
    // Se começar com 55 (Brasil)
    if (numbers.startsWith('55') && numbers.length >= 12) {
      const ddi = numbers.slice(0, 2);
      const ddd = numbers.slice(2, 4);
      const firstPart = numbers.slice(4, numbers.length - 4);
      const lastPart = numbers.slice(-4);
      return `+${ddi} ${ddd} ${firstPart}-${lastPart}`;
    }
    
    // Formato brasileiro sem DDI
    if (numbers.length === 11) {
      const ddd = numbers.slice(0, 2);
      const firstPart = numbers.slice(2, 7);
      const lastPart = numbers.slice(7);
      return `+55 ${ddd} ${firstPart}-${lastPart}`;
    }
    
    if (numbers.length === 10) {
      const ddd = numbers.slice(0, 2);
      const firstPart = numbers.slice(2, 6);
      const lastPart = numbers.slice(6);
      return `+55 ${ddd} ${firstPart}-${lastPart}`;
    }
    
    return phone;
  };

  // ✅ OTIMIZAÇÃO: Filtrar apenas pedidos de teste no frontend (outros filtros já vêm do backend)
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Aplicar filtro de pedidos de teste (único filtro que precisa ser feito no frontend)
    if (!showTestOrders) {
      filtered = filtered.filter(order => 
        !order.customer_email?.includes('test') && 
        !order.customer_email?.includes('@teste') &&
        !order.customer_email?.includes('@musiclovely.com') &&
        order.is_test_order !== true
      );
    }

    return filtered;
  }, [orders, showTestOrders, debouncedSearchTerm]);

  // ✅ OTIMIZAÇÃO: Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, planFilter, providerFilter, showTestOrders]);

  // ✅ NOVO: Usar estatísticas reais do hook useOrdersStats
  // Aplicar filtro de pedidos de teste nas estatísticas se necessário
  const stats = useMemo(() => {
    // Se ainda está carregando, retornar null para não mostrar cards zerados
    if (statsLoading || !statsData) {
      return null;
    }
    
    // Se não está mostrando pedidos de teste, precisamos filtrar
    // Como o hook busca do banco, não temos como filtrar pedidos de teste diretamente
    // Por enquanto, retornamos os valores do hook (que incluem todos)
    // TODO: Se necessário, podemos adicionar filtro de pedidos de teste no hook também
    return {
      total: statsData.total,
      totalPaid: statsData.totalPaid,
      pending: statsData.pending,
      conversionRate: statsData.conversionRate
    };
  }, [statsData, statsLoading, showTestOrders]);

  // ✅ OTIMIZAÇÃO: Removido loadOrders - agora usa React Query

  const handleConvertTestToNormal = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja converter esta venda teste em uma venda normal?")) {
      return;
    }

    try {
      setConvertingOrder(orderId);
      toast.info("Convertendo venda teste...");

      const newEmail = prompt("Digite o novo email do cliente (ou deixe vazio para manter o atual):");
      const newCustomerName = prompt("Digite o nome do cliente (opcional):");

      const { data, error } = await supabase.functions.invoke('convert-test-to-normal', {
        body: {
          orderId,
          newEmail: newEmail || undefined,
          newCustomerName: newCustomerName || undefined
        }
      });

      if (error) throw error;
      
      toast.success("Venda teste convertida para venda normal com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao converter venda:", error);
      toast.error(`Erro ao converter venda: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setConvertingOrder(null);
    }
  };



  // Paginação
  const currentOrders = filteredOrders;
  const totalPages = Math.max(1, Math.ceil((totalOrders || currentOrders.length) / ordersPerPage));

  // ✅ CORREÇÃO: Não renderizar até que a role seja verificada (evita flash)
  // Só renderizar quando tivermos CERTEZA da role (localStorage OU hook confirmado)
  const hasConfirmedRole = roleVerified && (initialRole || cachedRole || (!isRoleLoading && userRole));
  
  if (!hasConfirmedRole) {
    return <AdminPageLoading text="Verificando permissões..." />;
  }
  
  // ✅ OTIMIZAÇÃO: Usar componente de loading unificado
  if (loading && orders.length === 0 && !ordersError) {
    return <AdminPageLoading text="Carregando pedidos..." />;
  }
  
  // ✅ Mostrar erro apenas se não houver dados carregados
  if (ordersError && orders.length === 0) {
    return (
      <div className="container mx-auto p-2 md:p-6">
        <div className="text-center py-12">
          <p className="text-destructive text-lg font-semibold mb-2">Erro ao carregar pedidos</p>
          <p className="text-muted-foreground mb-4">
            {ordersError instanceof Error ? ordersError.message : 'Erro desconhecido'}
          </p>
          <Button onClick={() => refetch()} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
      {/* ✅ CSS inline para ocultar card "Pago" para colaboradores */}
      <style>{`
        /* Ocultar card "Pago" se o usuário for colaborador */
        body[data-user-role="collaborator"] .admin-card-compact:has([data-card="pago"]),
        .admin-card-compact[data-card="pago"][data-hide-for-collaborator="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      <div className="mb-2 md:mb-4">
        <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Pedidos
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Gerenciamento de pedidos</p>
      </div>

      <div className={`grid gap-2 md:gap-4 ${isCollaborator ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {/* Card: Total de Pedidos - sempre mostra */}
          {cardsToShow.includes('total') && (
            <Card
              className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow"
              data-testid="stats-total-orders"
            >
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full z-0" />
              <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Total de Pedidos</CardTitle>
                <DollarSign className="h-3 w-3 text-primary shrink-0" />
              </CardHeader>
              <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
                <div className="text-xl md:text-3xl font-bold select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {stats ? stats.total.toLocaleString('pt-BR') : '—'}
                </div>
                <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
                  <span className="text-[9px] md:text-[10px] text-muted-foreground">pedidos registrados</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* ✅ Card "Pago" - EXCLUÍDO do array para colaboradores */}
          {/* Só renderiza se 'pago' estiver no array cardsToShow (nunca para colaboradores) */}
          {cardsToShow.includes('pago') && (
            <Card
              className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow"
              data-testid="stats-total-revenue"
              data-card="pago"
              data-hide-for-collaborator="true"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full z-0" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/5 rounded-tr-full z-0" />
              <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Pago</CardTitle>
                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
              </CardHeader>
              <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10 min-h-[3rem] md:min-h-[4rem] flex items-center">
                <div className="text-base md:text-2xl font-bold text-green-600 select-text w-full whitespace-nowrap overflow-hidden text-ellipsis" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {stats
                    ? `R$ ${stats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Card: Pendentes - sempre mostra */}
          {cardsToShow.includes('pendentes') && (
            <Card
              className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow"
              data-testid="stats-pending-orders"
            >
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/5 rounded-tr-full z-0" />
              <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Pendentes</CardTitle>
                <Clock className="h-3 w-3 text-orange-500 shrink-0" />
              </CardHeader>
              <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
                <div className="text-xl md:text-3xl font-bold text-orange-500 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {stats ? stats.pending.toLocaleString('pt-BR') : '—'}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Card: Conversão - sempre mostra */}
          {cardsToShow.includes('conversao') && (
            <Card
              className="admin-card-compact relative overflow-hidden border-2 hover:shadow-lg transition-shadow"
              data-testid="stats-conversion-rate"
            >
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-tr-full z-0" />
              <CardHeader className="flex flex-row items-center justify-between pb-0 p-1 md:p-2 relative z-10">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">Conversão</CardTitle>
                <DollarSign className="h-3 w-3 text-blue-500 shrink-0" />
              </CardHeader>
              <CardContent className="p-1 pt-0 md:p-2 md:pt-0 relative z-10">
                <div className="text-xl md:text-3xl font-bold text-blue-600 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {stats ? `${stats.conversionRate.toFixed(1)}%` : '—'}
                </div>
              </CardContent>
            </Card>
          )}
      </div>
      
      {/* Mostrar loading apenas quando estiver carregando estatísticas */}
      {statsLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando estatísticas...</span>
        </div>
      )}

      <Card className="admin-card-compact border-2 hover:shadow-lg transition-shadow">
        <CardHeader className="p-1 md:p-2">
          <CardTitle className="text-[10px] md:text-xs font-medium">Pedidos</CardTitle>
          <div 
            className="flex flex-col md:flex-row gap-2 md:gap-3 mt-3 md:mt-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground pointer-events-none z-10" />
            <Input
              data-testid="search-input"
              placeholder="Buscar por email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              className="text-sm"
              style={{ paddingLeft: '2.75rem' }}
            />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="filter-status" className="w-full md:w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger data-testid="filter-plan" className="w-full md:w-[140px] text-xs">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="express">Express</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger data-testid="filter-provider" className="w-full md:w-[140px] text-xs">
                <SelectValue placeholder="Gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="cakto">Cakto</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-1 md:p-2 pt-0">
          <div data-testid="orders-table" role="table" aria-label="Pedidos" className="space-y-2 admin-orders-container">
            <table className="sr-only">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">ID</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Gateway</th>
                  <th scope="col">Data</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
            </table>
            {currentOrders.length === 0 && !loading ? (
              <div className="text-center py-12 md:py-16">
                <ShoppingCart className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-sm md:text-base font-medium mb-2">
                  Nenhum pedido encontrado
                </p>
                <p className="text-muted-foreground text-xs md:text-sm">
                  {searchTerm || statusFilter !== "all" || planFilter !== "all" || providerFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Quando houver pedidos, eles aparecerão aqui"}
                </p>
              </div>
            ) : (
              <>
                {/* ✅ BUSCA EM BACKGROUND: Removido indicador de loading durante busca */}
                <div data-testid="orders-list" className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {currentOrders.map((order) => (
                <div
                  key={order.id}
                  data-testid={`order-row-${order.id}`}
                  className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-accent/50 transition-colors gap-3 select-text order-item"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Linha 1: Email e Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium truncate">{order.customer_email}</p>
                      <OrderStatusBadge status={order.status} />
                      {(order.customer_email?.includes('test') || 
                        order.customer_email?.includes('@teste') ||
                        order.customer_email?.includes('@musiclovely.com') ||
                        order.is_test_order === true) && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <TestTube className="h-2.5 w-2.5 mr-0.5" />
                          Teste
                        </Badge>
                      )}
                    </div>
                    {/* Linha 2: Telefone */}
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className={`text-[11px] ${order.customer_whatsapp ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {order.customer_whatsapp ? formatPhone(order.customer_whatsapp) : "Sem telefone"}
                      </span>
                    </div>
                    {/* Linha 3: ID, Preço, Shipping, Payment, Data */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>ID: {order.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span className="font-medium text-foreground">R$ {(order.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span>•</span>
                      <span className="capitalize">{order.plan}</span>
                      <span>•</span>
                      <span className="capitalize">{order.provider || order.payment_provider || 'N/A'}</span>
                      <span>•</span>
                      <span>
                        {new Date(order.created_at).toLocaleDateString("pt-BR", { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(order.customer_email?.includes('test') || 
                      order.customer_email?.includes('@teste') ||
                      order.customer_email?.includes('@musiclovely.com') ||
                      order.is_test_order === true) && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleConvertTestToNormal(order.id)}
                        disabled={convertingOrder === order.id}
                        className="h-7 px-2 text-[10px]"
                      >
                        {convertingOrder === order.id ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        <span className="hidden sm:inline">Converter</span>
                        <span className="sm:hidden">✓</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                      data-testid="view-order-button"
                      className="h-7 px-2.5 text-[10px]"
                    >
                      <Eye className="h-3 w-3 mr-1.5" />
                      <span>Ver</span>
                    </Button>
                  </div>
                </div>
              ))}
              </div>
              </>
            )}
          </div>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="text-xs"
              >
                <span className="hidden sm:inline">Anterior</span>
                <span className="sm:hidden">‹</span>
              </Button>
              <span className="text-xs md:text-sm text-muted-foreground">
                <span className="hidden sm:inline">Página {currentPage} de {totalPages}</span>
                <span className="sm:hidden">{currentPage}/{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="text-xs"
              >
                <span className="hidden sm:inline">Próximo</span>
                <span className="sm:hidden">›</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
