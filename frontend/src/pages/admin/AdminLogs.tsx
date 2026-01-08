import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle, Clock, X, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { LogFilters, FilterState } from "./components/LogFilters";
import { LogDetailModal } from "./components/LogDetailModal";
import { LogsKPICards } from "./components/LogsKPICards";

interface CheckoutEvent {
  id: string;
  transaction_id: string;
  order_id: string | null;
  event_type: string;
  payload: any;
  error: string | null;
  created_at: string;
}

interface AdminLog {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  changes: any;
  created_at: string;
}

export default function AdminLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const adminUserIdParam = searchParams.get('admin_user_id');
  
  const [checkoutEvents, setCheckoutEvents] = useState<CheckoutEvent[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checkout' | 'admin'>(adminUserIdParam ? 'admin' : 'checkout');
  const [filters, setFilters] = useState<FilterState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<CheckoutEvent | AdminLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [adminUserInfo, setAdminUserInfo] = useState<{ id: string; name?: string; email?: string } | null>(null);
  
  const pageSize = 25;
  
  // Carregar informações do admin quando admin_user_id estiver na URL
  useEffect(() => {
    const loadAdminUserInfo = async () => {
      if (adminUserIdParam) {
        try {
          // Buscar informações do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', adminUserIdParam)
            .single();
          
          // Buscar email via edge function
          let email = '';
          try {
            const { data: emailData } = await supabase.functions.invoke('admin-get-collaborator-emails', {
              body: { user_ids: [adminUserIdParam] }
            });
            if (emailData?.emails) {
              email = emailData.emails[adminUserIdParam] || '';
            }
          } catch (err) {
            console.warn('Erro ao buscar email:', err);
          }
          
          setAdminUserInfo({
            id: adminUserIdParam,
            name: profile?.display_name || email || 'Colaborador',
            email: email
          });
        } catch (error) {
          console.error('Erro ao carregar informações do admin:', error);
          setAdminUserInfo({
            id: adminUserIdParam,
            name: 'Colaborador',
            email: ''
          });
        }
      } else {
        setAdminUserInfo(null);
      }
    };
    
    loadAdminUserInfo();
  }, [adminUserIdParam]);
  
  // Mudar para aba admin quando admin_user_id estiver na URL
  useEffect(() => {
    if (adminUserIdParam) {
      setActiveTab('admin');
    }
  }, [adminUserIdParam]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Verificar autenticação antes de fazer a query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      if (activeTab === 'checkout') {
        let query = supabase
          .from('checkout_events')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        // Apply filters
        if (filters.dateRange?.from) {
          const fromDate = filters.dateRange.from;
          if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
            query = query.gte('created_at', fromDate.toISOString());
          }
        }
        if (filters.dateRange?.to) {
          const toDate = filters.dateRange.to;
          if (toDate instanceof Date && !isNaN(toDate.getTime())) {
            query = query.lte('created_at', toDate.toISOString());
          }
        }
        if (filters.eventType) {
          query = query.eq('event_type', filters.eventType);
        }
        if (filters.transactionId && filters.transactionId.trim()) {
          query = query.ilike('transaction_id', `%${filters.transactionId.trim()}%`);
        }
        if (filters.hasError === 'true') {
          query = query.not('error', 'is', null);
        } else if (filters.hasError === 'false') {
          query = query.is('error', null);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('Erro ao carregar checkout_events:', error);
          throw new Error(`Erro ao carregar eventos: ${error.message || JSON.stringify(error)}`);
        }
        setCheckoutEvents(data || []);
        setTotalCount(count || 0);
      } else {
        let query = supabase
          .from('admin_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        // Filtrar por admin_user_id se estiver na URL
        if (adminUserIdParam) {
          query = query.eq('admin_user_id', adminUserIdParam);
        }

        // Apply filters
        if (filters.dateRange?.from) {
          const fromDate = filters.dateRange.from;
          if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
            query = query.gte('created_at', fromDate.toISOString());
          }
        }
        if (filters.dateRange?.to) {
          const toDate = filters.dateRange.to;
          if (toDate instanceof Date && !isNaN(toDate.getTime())) {
            query = query.lte('created_at', toDate.toISOString());
          }
        }
        if (filters.action) {
          query = query.eq('action', filters.action);
        }
        if (filters.transactionId && filters.transactionId.trim()) {
          // Simplificar: buscar apenas em target_id primeiro
          // Se necessário, podemos fazer duas queries e combinar
          query = query.ilike('target_id', `%${filters.transactionId.trim()}%`);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('Erro ao carregar admin_logs:', error);
          throw new Error(`Erro ao carregar logs admin: ${error.message || JSON.stringify(error)}`);
        }
        setAdminLogs(data || []);
        setTotalCount(count || 0);
      }
      
      setLastUpdate(new Date());
    } catch (error: unknown) {
      console.error('Erro completo ao carregar logs:', error);
      
      let errorMessage = 'Erro desconhecido ao carregar logs';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Tentar extrair mensagem de erro do Supabase
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('error' in error && typeof error.error === 'object' && error.error !== null) {
          if ('message' in error.error) {
            errorMessage = String(error.error.message);
          }
        } else {
          errorMessage = JSON.stringify(error);
        }
      }
      
      toast.error(`Erro ao carregar logs: ${errorMessage}`);
      
      // Se o erro for relacionado a tabela não encontrada, mostrar mensagem mais clara
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('permission denied')) {
        console.error('Possível problema de permissão ou tabela não existe:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, currentPage, pageSize, adminUserIdParam]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getEventTypeBadge = (eventType: string, hasError: boolean) => {
    if (hasError) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {eventType}
        </Badge>
      );
    }

    const successTypes = ['checkout_received', 'order_created', 'quiz_created'];
    if (successTypes.includes(eventType)) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" />
          {eventType}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        {eventType}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleRowClick = (log: CheckoutEvent | AdminLog) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };
  
  const handleClearAdminFilter = () => {
    setSearchParams({});
    setAdminUserInfo(null);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const currentData = activeTab === 'checkout' ? checkoutEvents : adminLogs;
  const errorCount = activeTab === 'checkout' 
    ? checkoutEvents.filter(e => e.error).length 
    : 0;
  const successRate = totalCount > 0 
    ? ((totalCount - errorCount) / totalCount) * 100 
    : 100;

  return (
    <div className="w-full max-w-full p-1 space-y-1">
      <div className="flex flex-col gap-1">
        <div>
          <h1 className="text-base font-bold">Logs do Sistema</h1>
          <p className="text-xs text-muted-foreground">
            Monitoramento
          </p>
        </div>
        <div className="flex gap-1">
          <LogFilters activeTab={activeTab} onFilterChange={handleFilterChange} />
          <Button onClick={loadLogs} variant="outline" size="sm" className="text-xs px-1 py-0.5 h-5">
            <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
            Atual.
          </Button>
        </div>
      </div>

      {/* Banner de filtro por admin */}
      {adminUserIdParam && adminUserInfo && (
        <Card className="admin-card-compact border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-medium">
                  Filtrando atividades de: <span className="text-primary">{adminUserInfo.name}</span>
                </p>
                {adminUserInfo.email && (
                  <p className="text-[10px] text-muted-foreground">{adminUserInfo.email}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAdminFilter}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar filtro
            </Button>
          </div>
        </Card>
      )}

      <LogsKPICards 
        totalEvents={totalCount}
        errorCount={errorCount}
        successRate={successRate}
        lastUpdate={lastUpdate}
      />

      <div className="flex gap-0.5 w-full">
        <Button
          variant={activeTab === 'checkout' ? 'default' : 'outline'}
          onClick={() => setActiveTab('checkout')}
          size="sm"
          className="flex-1 text-xs py-0.5 h-5"
        >
          Eventos
        </Button>
        <Button
          variant={activeTab === 'admin' ? 'default' : 'outline'}
          onClick={() => setActiveTab('admin')}
          size="sm"
          className="flex-1 text-xs py-0.5 h-5"
        >
          Admin
        </Button>
      </div>

      <Card className="admin-card-compact p-1 md:p-0.5 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-1">
            <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'checkout' ? (
          <div className="table-responsive">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="h-4">
                  <TableHead className="text-xs py-0.5 min-w-[80px]">Data</TableHead>
                  <TableHead className="text-xs py-0.5 min-w-[60px]">Tipo</TableHead>
                  <TableHead className="text-xs py-0.5 hidden sm:table-cell min-w-[80px]">Trans</TableHead>
                  <TableHead className="text-xs py-0.5 hidden md:table-cell min-w-[80px]">Order</TableHead>
                  <TableHead className="text-xs py-0.5 min-w-[120px]">Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-1 text-muted-foreground text-xs">
                      Nenhum evento
                    </TableCell>
                  </TableRow>
                ) : (
                  checkoutEvents.map((event) => (
                    <TableRow 
                      key={event.id} 
                      className="cursor-pointer hover:bg-muted/50 h-4"
                      onClick={() => handleRowClick(event)}
                    >
                      <TableCell className="font-mono text-xs py-0.5 break-words max-w-[80px]">
                        {formatDate(event.created_at)}
                      </TableCell>
                      <TableCell className="py-0.5 max-w-[60px]">
                        {getEventTypeBadge(event.event_type, !!event.error)}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell py-0.5 break-words max-w-[80px]">
                        {event.transaction_id ? `${event.transaction_id.slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell py-0.5 break-words max-w-[80px]">
                        {event.order_id ? `${String(event.order_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="py-0.5 break-words max-w-[120px]">
                        {event.error ? (
                          <span className="text-destructive text-xs break-words truncate block" title={event.error}>
                            {event.error.length > 20 ? `${event.error.slice(0, 20)}...` : event.error}
                          </span>
                        ) : event.payload ? (
                          <span className="text-xs text-muted-foreground break-words truncate block" title={JSON.stringify(event.payload)}>
                            {JSON.stringify(event.payload).length > 20 ? `${JSON.stringify(event.payload).slice(0, 20)}...` : JSON.stringify(event.payload)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="table-responsive">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="h-4">
                  <TableHead className="text-xs py-0.5 min-w-[80px]">Data</TableHead>
                  <TableHead className="text-xs py-0.5 min-w-[80px]">Ação</TableHead>
                  <TableHead className="text-xs py-0.5 hidden sm:table-cell min-w-[80px]">Tabela</TableHead>
                  <TableHead className="text-xs py-0.5 hidden md:table-cell min-w-[80px]">Target</TableHead>
                  <TableHead className="text-xs py-0.5 hidden lg:table-cell min-w-[80px]">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-1 text-muted-foreground text-xs">
                      Nenhum log
                    </TableCell>
                  </TableRow>
                ) : (
                  adminLogs.map((log) => (
                    <TableRow 
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50 h-4"
                      onClick={() => handleRowClick(log)}
                    >
                      <TableCell className="font-mono text-xs py-0.5 break-words max-w-[80px]">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="py-0.5 max-w-[80px]">
                        <Badge variant="outline" className="text-xs px-0.5 py-0 break-words">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell py-0.5 break-words max-w-[80px]">
                        {log.target_table}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell py-0.5 break-words max-w-[80px]">
                        {log.target_id ? `${String(log.target_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden lg:table-cell py-0.5 break-words max-w-[80px]">
                        {log.admin_user_id ? `${String(log.admin_user_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-0.5 px-0.5 py-0.5 border-t">
            <p className="text-xs text-muted-foreground">
              {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)}/{totalCount}
            </p>
            <div className="flex gap-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-xs px-1 py-0.5 h-4"
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="text-xs px-1 py-0.5 h-4"
              >
                ›
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LogDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        log={selectedLog}
        type={activeTab}
      />
    </div>
  );
}
