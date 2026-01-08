import { useEffect, useState, useMemo } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  RefreshCw, Search, MessageSquare, Phone, Mail, Clock, CheckCircle, 
  XCircle, AlertCircle, AlertTriangle, Filter, Eye, BarChart3, Download, 
  Send, Calendar, TrendingUp, Users, Activity, Play, Trash2, Pause, Rocket, ExternalLink, Globe
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ensureCheckoutLinks, generateCaktoUrl } from "@/utils/checkoutLinks";

interface WhatsappFunnel {
  id: string;
  order_id: string;
  customer_whatsapp: string;
  customer_email: string;
  funnel_status: 'pending' | 'active' | 'completed' | 'exited' | 'cancelled';
  current_step: number;
  last_message_sent_at: string | null;
  next_message_at: string | null;
  ab_variant: string | null;
  created_at: string;
  updated_at: string;
  exit_reason?: string | null;
  source_table?: 'pending' | 'completed' | 'exited'; // Tabela de origem
  is_paused?: boolean; // Indica se o funil está pausado
  // Campos duplicados (evitam joins)
  order_status?: string;
  order_amount_cents?: number;
  order_created_at?: string;
  order_plan?: string;
  quiz_id?: string;
  quiz_about_who?: string;
  // Dados relacionados (usando campos duplicados)
  order: {
    id: string;
    status: string;
    amount_cents: number;
    created_at: string;
    plan?: string;
    quiz_id?: string;
  };
  quiz?: {
    id: string;
    about_who?: string;
    language?: string;
  } | null;
  messages_count?: number;
  messages?: WhatsappMessage[];
}

interface WhatsappMessage {
  id: string;
  funnel_id: string;
  message_type: string;
  message_text: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  response_data: any;
}

const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  active: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
  exited: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  active: 'Ativo',
  completed: 'Completo',
  exited: 'Saiu',
  cancelled: 'Cancelado',
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  checkout_link: 'Link de Checkout',
  follow_up_1: 'Follow-up 1 (1h)',
  follow_up_2: 'Follow-up 2 (3h)',
  follow_up_3: 'Follow-up 3 (24h)',
  payment_thankyou: 'Agradecimento Pagamento',
  music_ready: 'Música Pronta',
  final_cancelled: 'Cancelado',
};

export default function AdminWhatsappFunnel() {
  const [funnels, setFunnels] = useState<WhatsappFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFunnel, setSelectedFunnel] = useState<WhatsappFunnel | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<WhatsappMessage | null>(null);
  const [draggedFunnel, setDraggedFunnel] = useState<WhatsappFunnel | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'stats'>('kanban');
  const [processingPending, setProcessingPending] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [deletingFunnelId, setDeletingFunnelId] = useState<string | null>(null);
  const [kanbanKey, setKanbanKey] = useState(0); // Forçar re-render do Kanban
  const [recentUpdates, setRecentUpdates] = useState<Map<string, { status: string; timestamp: number }>>(new Map()); // Rastrear atualizações recentes
  const [showAuditPanel, setShowAuditPanel] = useState(false); // Mostrar painel de auditoria
  const [auditData, setAuditData] = useState<any>(null); // Dados da auditoria
  const [auditLoading, setAuditLoading] = useState(false); // Loading da auditoria
  const [movingToCompleted, setMovingToCompleted] = useState<Set<string>>(new Set()); // Funis sendo movidos para completed
  const [sendingFunnels, setSendingFunnels] = useState<Set<string>>(new Set()); // Funis sendo disparados
  const [sendingBulk, setSendingBulk] = useState(false); // Disparo em massa em andamento
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 }); // Progresso do disparo em massa
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    sent: 0,
    failed: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    loadFunnels();
    checkPendingOrdersCount();
    
    // Executar auditoria automaticamente na primeira carga (após 3 segundos)
    const autoAudit = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos
        const { data, error } = await supabase.rpc('audit_pending_orders_funnel');
        if (!error && data && data.length > 0) {
          const grouped = (data as any[]).reduce((acc: any, row: any) => {
            const section = row.section || 'Outros';
            if (!acc[section]) acc[section] = [];
            acc[section].push({ metric: row.metric_name, value: row.metric_value, details: row.details });
            return acc;
          }, {});
          
        }
      } catch (err) {
        console.error('Erro ao executar auditoria automática:', err);
      }
    };
    
    // Migrar automaticamente pedidos pending sem funil na primeira carga
    const autoMigrate = async () => {
      try {
        const { data, error } = await supabase.rpc('auto_migrate_all_pending_orders');
        if (error) {
          console.error('Erro ao migrar pedidos automaticamente:', error);
        }
      } catch (err) {
        console.error('Erro ao executar migração automática:', err);
      }
    };
    
    // Executar migração automática após 2 segundos (dar tempo para carregar)
    const migrateTimeout = setTimeout(autoMigrate, 2000);
    
    // REMOVIDO: Auto-refresh automático
    // A atualização agora é apenas manual através do botão "Atualizar"
    // Isso evita que a página volte ao topo quando o usuário está trabalhando
    
    return () => {
      clearTimeout(migrateTimeout);
    };
  }, []);

  // Função para validar se um funil pode receber mensagem de checkout
  const validateFunnelForSending = async (funnel: WhatsappFunnel): Promise<{
    valid: boolean;
    reason?: string;
  }> => {
    try {
      // Verificar se funil está pausado
      if (funnel.is_paused === true) {
        return { valid: false, reason: 'Funil está pausado' };
      }

      // Verificar se pedido ainda está pending
      if (funnel.order?.status !== 'pending') {
        return { valid: false, reason: `Pedido está ${funnel.order?.status || 'desconhecido'}` };
      }

      // Verificar se WhatsApp é válido
      if (!funnel.customer_whatsapp || funnel.customer_whatsapp.trim().length < 10) {
        return { valid: false, reason: 'WhatsApp inválido' };
      }

      // Verificar se já recebeu mensagem de checkout
      // ⚠️ CORREÇÃO: Usar .maybeSingle() ao invés de .single() para evitar erro 406 quando não há mensagem
      const { data: existingMessage, error: messageError } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('funnel_id', funnel.id)
        .eq('message_type', 'checkout_link')
        .eq('status', 'sent')
        .maybeSingle();

      // Se houver erro (exceto "not found"), logar mas continuar
      if (messageError && messageError.code !== 'PGRST116') {
        console.error('Erro ao verificar mensagem existente:', messageError);
      }

      if (existingMessage) {
        return { valid: false, reason: 'Mensagem já foi enviada' };
      }

      // Verificar se tem quiz_id
      if (!funnel.quiz_id && !funnel.order?.quiz_id) {
        return { valid: false, reason: 'Pedido não tem quiz associado' };
      }

      // Verificar tempo mínimo (7 minutos desde pending_at)
      const pendingAt = funnel.order?.created_at || funnel.created_at;
      const pendingDate = new Date(pendingAt);
      const minutesSincePending = Math.floor((Date.now() - pendingDate.getTime()) / (1000 * 60));

      if (minutesSincePending < 7) {
        return { 
          valid: false, 
          reason: `Aguardando 7 minutos (${minutesSincePending}min decorridos)` 
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Erro ao validar funil:', error);
      return { valid: false, reason: 'Erro ao validar' };
    }
  };

  // Função para verificar e mover funis de pedidos pagos
  const checkPaidOrders = async () => {
    try {
      
      // Buscar funis em pending
      const { data: pendingFunnels, error: funnelsError } = await supabase
        .from('whatsapp_funnel_pending')
        .select('id, order_id, order_status')
        .limit(100);
      
      if (funnelsError) {
        console.error('Erro ao buscar funis pending:', funnelsError);
        return;
      }
      
      if (!pendingFunnels || pendingFunnels.length === 0) {
        return; // Nenhum funil em pending
      }
      
      // Buscar status real dos pedidos
      const orderIds = pendingFunnels.map(f => f.order_id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', orderIds);
      
      if (ordersError) {
        console.error('Erro ao buscar pedidos:', ordersError);
        return;
      }
      
      if (!orders) {
        return;
      }
      
      // Criar mapa de status
      const orderStatusMap = new Map<string, string>();
      orders.forEach(order => {
        orderStatusMap.set(order.id, order.status);
      });
      
      // Encontrar funis cujos pedidos foram pagos
      const paidFunnels = pendingFunnels.filter(funnel => {
        const realStatus = orderStatusMap.get(funnel.order_id) || funnel.order_status;
        return realStatus === 'paid';
      });
      
      if (paidFunnels.length === 0) {
        return; // Nenhum pedido pago encontrado
      }
      
      
      // Mover cada funil para completed
      setMovingToCompleted(new Set(paidFunnels.map(f => f.id)));
      let movedCount = 0;
      
      for (const funnel of paidFunnels) {
        try {
          const { error: moveError } = await supabase.rpc('move_funnel_to_completed', {
            p_funnel_id: funnel.id
          });
          
          if (moveError) {
            console.error(`❌ [AdminWhatsappFunnel] Erro ao mover funil ${funnel.id}:`, moveError);
            setMovingToCompleted(prev => {
              const updated = new Set(prev);
              updated.delete(funnel.id);
              return updated;
            });
          } else {
            movedCount++;
            toast.success(`Pedido pago detectado! Funil movido para "Completo"`, {
              description: `Pedido ${funnel.order_id.slice(0, 8)}... foi pago`,
              duration: 3000,
            });
            // Remover do set após um delay
            setTimeout(() => {
              setMovingToCompleted(prev => {
                const updated = new Set(prev);
                updated.delete(funnel.id);
                return updated;
              });
            }, 2000);
          }
        } catch (err) {
          console.error(`❌ [AdminWhatsappFunnel] Erro ao processar funil ${funnel.id}:`, err);
          setMovingToCompleted(prev => {
            const updated = new Set(prev);
            updated.delete(funnel.id);
            return updated;
          });
        }
      }
      
      if (movedCount > 0) {
        // Atualizar estado local sem recarregar (evita scroll para o topo)
        // O usuário pode atualizar manualmente quando quiser
        setFunnels(prev => {
          return prev.map(f => {
            if (paidFunnels.some(pf => pf.id === f.id)) {
              // Marcar como movido localmente
              return {
                ...f,
                funnel_status: 'completed' as any,
                source_table: 'completed' as any,
              };
            }
            return f;
          });
        });
      } else {
        // Limpar set se nenhum foi movido após um delay
        setTimeout(() => {
          setMovingToCompleted(new Set());
        }, 1000);
      }
    } catch (error) {
      console.error('❌ [AdminWhatsappFunnel] Erro ao verificar pedidos pagos:', error);
    }
  };

  const checkPendingOrdersCount = async () => {
    try {
      // Buscar TODOS os pedidos pendentes com WhatsApp E quiz_id que não têm funil (sem restrição de tempo)
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_whatsapp, quiz_id')
        .eq('status', 'pending')
        .not('customer_whatsapp', 'is', null)
        .neq('customer_whatsapp', '')
        .not('quiz_id', 'is', null); // IMPORTANTE: Verificar quiz_id também

      if (ordersError) {
        console.error('Erro ao buscar pedidos pendentes:', ordersError);
        setPendingOrdersCount(0);
        return;
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        setPendingOrdersCount(0);
        return;
      }


      // Verificar quais já têm funil (em qualquer uma das 3 tabelas)
      // IMPORTANTE: Usar os mesmos critérios da auditoria para garantir consistência
      const orderIds = pendingOrders.map(o => o.id);
      
      // Buscar funis de todas as tabelas
      const [pendingFunnels, completedFunnels, exitedFunnels] = await Promise.all([
        supabase.from('whatsapp_funnel_pending').select('order_id').in('order_id', orderIds),
        supabase.from('whatsapp_funnel_completed').select('order_id').in('order_id', orderIds),
        supabase.from('whatsapp_funnel_exited').select('order_id').in('order_id', orderIds),
      ]);
      
      // Criar Set com order_ids únicos (evitar duplicatas)
      const existingOrderIds = new Set<string>();
      (pendingFunnels.data || []).forEach(f => existingOrderIds.add(f.order_id));
      (completedFunnels.data || []).forEach(f => existingOrderIds.add(f.order_id));
      (exitedFunnels.data || []).forEach(f => existingOrderIds.add(f.order_id));
      
      // Verificar erros
      if (pendingFunnels.error || completedFunnels.error || exitedFunnels.error) {
        const firstError = pendingFunnels.error || completedFunnels.error || exitedFunnels.error;
        console.error('Erro ao verificar funis existentes:', firstError);
        // Se não conseguir verificar, assume que todos precisam de funil
        setPendingOrdersCount(pendingOrders.length);
        return;
      }

      // Filtrar pedidos que não têm funil
      const ordersWithoutFunnel = pendingOrders.filter(o => !existingOrderIds.has(o.id));
      
      setPendingOrdersCount(ordersWithoutFunnel.length);
    } catch (error) {
      console.error('❌ [AdminWhatsappFunnel] Erro ao verificar pedidos pendentes:', error);
      setPendingOrdersCount(0);
    }
  };

  const handleMigrateAllPendingOrders = async () => {
    if (!confirm(`Migrar TODOS os pedidos pending (sem limite de data) que não têm funil?\n\nIsso criará funis para pedidos antigos que ainda estão pending.`)) {
      return;
    }

    try {
      setProcessingPending(true);
      toast.info('Migrando todos os pedidos pending...');

      // Tentar chamar função RPC primeiro
      let result: { funnels_created: number; orders_processed: string[]; failed_orders?: any } | null = null;
      let useFallback = false;

      try {
        const { data, error } = await supabase.rpc('migrate_all_pending_orders_to_funnel');

        if (error) {
          console.error('❌ [MigrateAll] Erro ao chamar função RPC:', error);
          // Se função não existe, usar fallback
          if (error.message?.includes('Could not find the function') || error.message?.includes('does not exist')) {
            useFallback = true;
          } else {
            throw error;
          }
        } else {
          // PostgreSQL RETURNS TABLE retorna um array de objetos
          if (Array.isArray(data)) {
            if (data.length > 0) {
              result = data[0] as any;
            } else {
              result = null;
            }
          } else if (data && typeof data === 'object') {
            // Se já é um objeto, usar diretamente
            result = data as any;
          } else {
            result = null;
          }
        }
      } catch (rpcError: any) {
        console.error('❌ [MigrateAll] Exceção ao chamar função RPC:', rpcError);
        if (rpcError.message?.includes('Could not find the function') || rpcError.message?.includes('does not exist')) {
          useFallback = true;
        } else {
          throw rpcError;
        }
      }

      // Fallback: processar pedidos individualmente
      if (useFallback || !result) {
        toast.info('Processando pedidos individualmente...');

        // Buscar pedidos pending sem funil
        const { data: pendingOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, customer_whatsapp, customer_email, quiz_id')
          .eq('status', 'pending')
          .not('customer_whatsapp', 'is', null)
          .neq('customer_whatsapp', '');

        if (ordersError) {
          throw ordersError;
        }

        if (!pendingOrders || pendingOrders.length === 0) {
          toast.info('Nenhum pedido pending encontrado');
          setProcessingPending(false);
          return;
        }

        // Verificar quais já têm funil
        const orderIds = pendingOrders.map(o => o.id);
        const [pendingFunnels, completedFunnels, exitedFunnels] = await Promise.all([
          supabase.from('whatsapp_funnel_pending').select('order_id').in('order_id', orderIds),
          supabase.from('whatsapp_funnel_completed').select('order_id').in('order_id', orderIds),
          supabase.from('whatsapp_funnel_exited').select('order_id').in('order_id', orderIds),
        ]);

        const existingOrderIds = new Set([
          ...(pendingFunnels.data?.map(f => f.order_id) || []),
          ...(completedFunnels.data?.map(f => f.order_id) || []),
          ...(exitedFunnels.data?.map(f => f.order_id) || []),
        ]);

        const ordersToProcess = pendingOrders.filter(o => 
          !existingOrderIds.has(o.id) && 
          o.quiz_id !== null
        );

        if (ordersToProcess.length === 0) {
          toast.info('Todos os pedidos pending já têm funil ou não têm quiz_id');
          setProcessingPending(false);
          return;
        }

        toast.info(`Processando ${ordersToProcess.length} pedido(s)...`);

        let processed = 0;
        let errors = 0;
        const errorDetails: Array<{ order_id: string; error: string }> = [];

        for (const order of ordersToProcess) {
          try {
            const { data: funnelId, error: createError } = await supabase.rpc('create_funnel_for_order', {
              p_order_id: order.id
            });

            if (createError || !funnelId) {
              console.error(`❌ Erro ao criar funil para pedido ${order.id}:`, createError);
              errors++;
              errorDetails.push({
                order_id: order.id,
                error: createError?.message || 'create_funnel_for_order retornou NULL'
              });
            } else {
              processed++;
            }
          } catch (err: any) {
            console.error(`❌ Erro ao processar pedido ${order.id}:`, err);
            errors++;
            errorDetails.push({
              order_id: order.id,
              error: err.message || 'Erro desconhecido'
            });
          }
        }

        if (processed > 0) {
          toast.success(`${processed} funil(is) criado(s) com sucesso!`);
          // Aguardar antes de recarregar
          await new Promise(resolve => setTimeout(resolve, 2000));
          setFunnels([]);
          await loadFunnels();
          await checkPendingOrdersCount();
        }
        if (errors > 0) {
          console.error('❌ Erros detalhados:', errorDetails);
          toast.warning(`${errors} erro(s) ao processar alguns pedidos. Verifique o console.`, {
            duration: 5000,
          });
        }

        result = {
          funnels_created: processed,
          orders_processed: ordersToProcess.slice(0, processed).map(o => o.id),
          failed_orders: errorDetails
        };
      }

      if (result) {
        // Extrair valores do resultado (pode vir como objeto ou com propriedades aninhadas)
        const funnelsCreated = (result as any).funnels_created ?? 0;
        const ordersProcessed = (result as any).orders_processed ?? [];
        const failedOrders = (result as any).failed_orders;
        
        if (funnelsCreated > 0) {
          toast.success(`${funnelsCreated} funil(is) criado(s) com sucesso para pedidos antigos!`);
          
          // Mostrar detalhes de pedidos que falharam
          if (failedOrders) {
            const failedArray = Array.isArray(failedOrders) 
              ? failedOrders 
              : (typeof failedOrders === 'object' && failedOrders !== null 
                  ? [failedOrders] 
                  : []);
            
            if (failedArray.length > 0) {
              toast.warning(`${failedArray.length} pedido(s) falharam. Verifique o console para detalhes.`, {
                duration: 5000,
              });
            }
          }
          
          // Aguardar 2 segundos antes de recarregar para garantir que dados foram persistidos
          await new Promise(resolve => setTimeout(resolve, 2000));
          // Limpar estado antes de recarregar
          setFunnels([]);
          await loadFunnels();
          await checkPendingOrdersCount();
        } else {
          // Verificar se há pedidos que falharam
          if (failedOrders) {
            const failedArray = Array.isArray(failedOrders) 
              ? failedOrders 
              : (typeof failedOrders === 'object' && failedOrders !== null 
                  ? [failedOrders] 
                  : []);
            
            if (failedArray.length > 0) {
              toast.warning(`Nenhum funil foi criado. ${failedArray.length} pedido(s) falharam. Verifique o console.`, {
                duration: 5000,
              });
            } else {
              toast.info('Nenhum funil foi criado. Todos os pedidos pending já têm funil ou não atendem aos critérios.');
            }
          } else {
            toast.info('Nenhum funil foi criado. Todos os pedidos pending já têm funil ou não atendem aos critérios.');
          }
        }
      } else {
        toast.info('Nenhum funil foi criado. Todos os pedidos pending já têm funil ou não atendem aos critérios.');
      }
    } catch (error: any) {
      console.error('Erro ao migrar pedidos:', error);
      toast.error(`Erro ao migrar pedidos: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setProcessingPending(false);
    }
  };

  const handleDiagnosePendingOrders = async () => {
    try {
      setProcessingPending(true);
      toast.info('Diagnosticando pedidos pending...');

      // Chamar função de diagnóstico
      const { data, error } = await supabase.rpc('diagnose_pending_orders_without_funnel');

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        toast.info('Nenhum pedido pending sem funil encontrado.');
        return;
      }

      // Agrupar por motivo
      const byReason = (data as any[]).reduce((acc: any, order: any) => {
        const reason = order.reason || 'Desconhecido';
        if (!acc[reason]) {
          acc[reason] = [];
        }
        acc[reason].push(order);
        return acc;
      }, {});

      const canCreate = (data as any[]).filter((o: any) => o.can_create_funnel === true);
      const cannotCreate = (data as any[]).filter((o: any) => o.can_create_funnel === false);

      // Mostrar resumo em um formato mais legível
      let message = `📊 DIAGNÓSTICO DE PEDIDOS PENDING\n\n`;
      message += `Total: ${data.length} pedidos pending sem funil\n\n`;
      message += `✅ Podem ter funil: ${canCreate.length}\n`;
      message += `❌ Não podem ter funil: ${cannotCreate.length}\n\n`;
      
      if (Object.keys(byReason).length > 0) {
        message += `📋 Motivos:\n`;
        Object.entries(byReason).forEach(([reason, orders]: [string, any]) => {
          message += `  • ${reason}: ${orders.length}\n`;
        });
      }
      
      if (canCreate.length > 0) {
        message += `\n💡 Ação: Use o botão "Migrar Todos" para criar funis para os ${canCreate.length} pedidos que podem ter funil.`;
      }

      // Mostrar em um dialog mais amigável
      confirm(message);
    } catch (error: any) {
      console.error('Erro ao diagnosticar pedidos:', error);
      toast.error(`Erro ao diagnosticar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setProcessingPending(false);
    }
  };

  const handleCreateFunnelsDirectly = async () => {
    if (!confirm(`Criar funis para pedidos pending com mais de 7 minutos?\n\nIsso criará funis apenas para pedidos que já passaram do intervalo inicial.`)) {
      return;
    }

    try {
      setProcessingPending(true);
      toast.info('Criando funis para pedidos pending (7min+)...');

      // Chamar função SQL diretamente via RPC
      const { data, error } = await supabase.rpc('create_whatsapp_funnels_for_pending_orders');

      if (error) {
        throw error;
      }

      const result = data as { funnels_created: number; orders_processed: string[] } | null;
      
      if (result && result.funnels_created > 0) {
        toast.success(`${result.funnels_created} funil(is) criado(s) com sucesso!`);
        // Aguardar antes de recarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        setFunnels([]);
        await loadFunnels();
        await checkPendingOrdersCount();
      } else {
        toast.info('Nenhum funil foi criado. Todos os pedidos pendentes já têm funil ou não atendem aos critérios.');
      }
    } catch (error: any) {
      console.error('Erro ao criar funis:', error);
      toast.error(`Erro ao criar funis: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setProcessingPending(false);
    }
  };

  const handleProcessPendingOrders = async () => {
    if (!confirm(`Processar TODOS os pedidos pendentes com WhatsApp que ainda não têm funil?\n\nIsso criará funis e enviará mensagens WhatsApp imediatamente.`)) {
      return;
    }

    try {
      setProcessingPending(true);
      toast.info('Buscando pedidos pendentes...');

      // Buscar TODOS os pedidos pendentes com WhatsApp (sem restrição de tempo)
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_whatsapp, customer_email')
        .eq('status', 'pending')
        .not('customer_whatsapp', 'is', null)
        .neq('customer_whatsapp', '');

      if (ordersError) {
        throw ordersError;
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        toast.info('Nenhum pedido pendente com WhatsApp encontrado');
        setProcessingPending(false);
        return;
      }


      // Verificar quais já têm funil (em qualquer uma das 3 tabelas)
      const orderIds = pendingOrders.map(o => o.id);
      const [pendingFunnels, completedFunnels, exitedFunnels] = await Promise.all([
        supabase.from('whatsapp_funnel_pending').select('order_id').in('order_id', orderIds),
        supabase.from('whatsapp_funnel_completed').select('order_id').in('order_id', orderIds),
        supabase.from('whatsapp_funnel_exited').select('order_id').in('order_id', orderIds),
      ]);
      
      const existingFunnels = {
        data: [
          ...(pendingFunnels.data || []),
          ...(completedFunnels.data || []),
          ...(exitedFunnels.data || []),
        ],
        error: pendingFunnels.error || completedFunnels.error || exitedFunnels.error
      };

      if (existingFunnels.error) {
        console.error('Erro ao verificar funis existentes:', existingFunnels.error);
      }

      const existingOrderIds = new Set((existingFunnels?.data || []).map(f => f.order_id));
      const ordersToProcess = pendingOrders.filter(o => !existingOrderIds.has(o.id));

      if (ordersToProcess.length === 0) {
        toast.info('Todos os pedidos pendentes já têm funil criado');
        await loadFunnels();
        await checkPendingOrdersCount();
        setProcessingPending(false);
        return;
      }

      toast.info(`Processando ${ordersToProcess.length} pedido(s)...`);

      // Processar cada pedido
      let processed = 0;
      let errors = 0;
      const errorDetails: Array<{ order_id: string; error: string }> = [];

      for (const order of ordersToProcess) {
        try {
          const { data, error } = await supabase.functions.invoke('send-checkout-link', {
            body: { order_id: order.id },
          });

          if (error) {
            console.error(`❌ Erro ao processar pedido ${order.id}:`, error);
            errors++;
            errorDetails.push({ order_id: order.id, error: error.message || 'Erro desconhecido' });
          } else if (!data?.success) {
            console.error(`❌ Pedido ${order.id} não foi processado:`, data?.error);
            errors++;
            errorDetails.push({ order_id: order.id, error: data?.error || 'Erro desconhecido' });
          } else {
            processed++;
          }
        } catch (err) {
          console.error(`❌ Erro ao processar pedido ${order.id}:`, err);
          errors++;
          errorDetails.push({ 
            order_id: order.id, 
            error: err instanceof Error ? err.message : 'Erro desconhecido' 
          });
        }
      }

      if (processed > 0) {
        toast.success(`${processed} pedido(s) processado(s) com sucesso!`);
        await loadFunnels();
        await checkPendingOrdersCount();
      }

      if (errors > 0) {
        console.error('Erros detalhados:', errorDetails);
        toast.warning(`${errors} erro(s) ao processar alguns pedidos. Verifique o console.`);
      }

      if (processed === 0 && errors === 0) {
        toast.info('Nenhum pedido foi processado');
      }
    } catch (error: any) {
      console.error('Erro ao processar pedidos pendentes:', error);
      toast.error(`Erro ao processar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setProcessingPending(false);
    }
  };

  const loadFunnels = async () => {
    try {
      setLoading(true);
      
      
      // Buscar de todas as 3 tabelas separadas
      const [pendingResult, completedResult, exitedResult] = await Promise.all([
        supabase.from("whatsapp_funnel_pending").select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from("whatsapp_funnel_completed").select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from("whatsapp_funnel_exited").select("*").order("updated_at", { ascending: false }).limit(500),
      ]);

      // Verificar erros
      const errors = [pendingResult.error, completedResult.error, exitedResult.error].filter(Boolean);
      if (errors.length > 0) {
        const firstError = errors[0];
        console.error('❌ [AdminWhatsappFunnel] Erro ao buscar funis:', firstError);
        
        // Se as tabelas não existem, mostrar mensagem mas não quebrar a página
        if (firstError?.code === '42P01' || firstError?.message?.includes('does not exist')) {
          toast.warning("Tabelas do funil não foram criadas. Execute as migrations primeiro.", {
            duration: 10000,
          });
          setFunnels([]);
          setLoading(false);
          return;
        }
        
        // Se não tem permissão, mostrar mensagem mas não quebrar
        if (firstError?.code === '42501' || firstError?.message?.includes('permission')) {
          toast.warning("Sem permissão para acessar funis. Verifique as políticas RLS.", {
            duration: 10000,
          });
          setFunnels([]);
          setLoading(false);
          return;
        }
        
        // Para outros erros, apenas logar e continuar com arrays vazios
        setFunnels([]);
        setLoading(false);
        return;
      }

      // Combinar funis de todas as tabelas e adicionar source_table
      const pendingFunnels = (pendingResult.data || []).map(f => ({ 
        ...f, 
        source_table: 'pending' as const,
        funnel_status: 'active' as const // Marcar como active para compatibilidade, mas source_table define a coluna
      }));
      const completedFunnels = (completedResult.data || []).map(f => ({ 
        ...f, 
        source_table: 'completed' as const,
        funnel_status: 'completed' as const
      }));
      const exitedFunnels = (exitedResult.data || []).map(f => ({ 
        ...f, 
        source_table: 'exited' as const,
        funnel_status: 'exited' as const
      }));
      
      const allFunnels = [...pendingFunnels, ...completedFunnels, ...exitedFunnels];

      // Filtrar apenas funis com WhatsApp válido
      const funnelsData = allFunnels.filter(
        f => f.customer_whatsapp && 
        f.customer_whatsapp.trim().length > 0
      );

      if (funnelsData.length === 0) {
        setFunnels([]);
        return;
      }
      const funnelsWithData = await Promise.all(
        funnelsData.map(async (funnel, index) => {
          // Usar campos duplicados para order (não precisa fazer join)
          const order = {
            id: funnel.order_id,
            status: funnel.order_status || 'pending',
            amount_cents: funnel.order_amount_cents || 0,
            created_at: funnel.order_created_at || funnel.created_at,
            plan: funnel.order_plan || undefined,
            quiz_id: funnel.quiz_id || undefined,
          };

          // Buscar quiz completo para obter language
          let quiz = null;
          if (funnel.quiz_id) {
            const { data: quizData } = await supabase
              .from('quizzes')
              .select('id, about_who, language')
              .eq('id', funnel.quiz_id)
              .single();
            
            quiz = quizData ? {
              id: quizData.id,
              about_who: quizData.about_who || undefined,
              language: quizData.language || 'pt',
            } : null;
          }

          // Buscar mensagens com detalhes completos
          let messages: WhatsappMessage[] = [];
          try {
            const { data: messagesData, error: messagesError } = await supabase
              .from("whatsapp_messages")
              .select("*")
              .eq("funnel_id", funnel.id)
              .order("created_at", { ascending: true });

            if (messagesError) {
              messages = []; // Garantir que seja array vazio em caso de erro
            } else {
              messages = (messagesData || []) as WhatsappMessage[];
              // Validar que todas as mensagens têm status válido
              messages = messages.filter(m => m && m.status && ['pending', 'sent', 'failed', 'cancelled'].includes(m.status));
            }
          } catch (err) {
            messages = []; // Garantir que seja array vazio em caso de erro
          }

          // Calcular contadores para validação
          const sentCount = messages.filter(m => m.status === 'sent').length;
          const failedCount = messages.filter(m => m.status === 'failed').length;
          const pendingCount = messages.filter(m => m.status === 'pending').length;
          
          // Determinar funnel_status baseado na tabela de origem
          // IMPORTANTE: Manter source_table para determinar a coluna do Kanban
          let funnel_status: 'pending' | 'active' | 'completed' | 'exited' | 'cancelled';
          if (funnel.source_table === 'pending') {
            funnel_status = 'active'; // Pending = active para compatibilidade, mas source_table='pending' define a coluna
          } else if (funnel.source_table === 'completed') {
            funnel_status = 'completed';
          } else if (funnel.source_table === 'exited') {
            funnel_status = 'exited';
          } else {
            // Fallback: se source_table não estiver definido, tentar inferir
            funnel_status = 'active';
          }
          

          return {
            ...funnel,
            source_table: funnel.source_table, // PRESERVAR source_table para determinar a coluna do Kanban
            funnel_status, // Usar status determinado pela tabela
            is_paused: funnel.is_paused ?? (funnel.source_table === 'exited' ? true : false), // Funis exited começam pausados
            order: order,
            quiz: quiz,
            messages: messages, // Garantir que sempre seja um array
            messages_count: messages.length,
          };
        })
      );

      // Verificar status real dos pedidos na tabela orders para detectar pagamentos
      const pendingFunnelIds = funnelsWithData
        .filter(f => f.source_table === 'pending')
        .map(f => f.order_id);
      
      if (pendingFunnelIds.length > 0) {
        try {
          const { data: realOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, status')
            .in('id', pendingFunnelIds);
          
          if (!ordersError && realOrders) {
            const paidOrderIds = new Set(
              realOrders
                .filter(o => o.status === 'paid')
                .map(o => o.id)
            );
            
            if (paidOrderIds.size > 0) {
              // Mover funis pagos para completed
              const funnelsToMove = funnelsWithData.filter(f => 
                f.source_table === 'pending' && paidOrderIds.has(f.order_id)
              );
              
              // Mover cada funil para completed
              setMovingToCompleted(new Set(funnelsToMove.map(f => f.id)));
              
              for (const funnel of funnelsToMove) {
                try {
                  const { error: moveError } = await supabase.rpc('move_funnel_to_completed', {
                    p_funnel_id: funnel.id
                  });
                  
                  if (moveError) {
                    console.error(`Erro ao mover funil ${funnel.id}:`, moveError);
                    setMovingToCompleted(prev => {
                      const updated = new Set(prev);
                      updated.delete(funnel.id);
                      return updated;
                    });
                  } else {
                    toast.success(`Pedido pago detectado! Funil movido para "Completo"`, {
                      description: `Pedido ${funnel.order_id.slice(0, 8)}... foi pago`,
                      duration: 3000,
                    });
                    // Remover do set após um delay
                    setTimeout(() => {
                      setMovingToCompleted(prev => {
                        const updated = new Set(prev);
                        updated.delete(funnel.id);
                        return updated;
                      });
                    }, 2000);
                  }
                } catch (err) {
                  console.error(`Erro ao processar funil ${funnel.id}:`, err);
                  setMovingToCompleted(prev => {
                    const updated = new Set(prev);
                    updated.delete(funnel.id);
                    return updated;
                  });
                }
              }
              
              // Remover funis movidos da lista atual e recarregar
              if (funnelsToMove.length > 0) {
                const movedIds = new Set(funnelsToMove.map(f => f.id));
                const remainingFunnels = funnelsWithData.filter(f => !movedIds.has(f.id));
                setFunnels(remainingFunnels);
                
                // Recarregar após um breve delay para sincronizar
                setTimeout(() => {
                  loadFunnels();
                }, 1000);
                return;
              }
            }
          }
        } catch (err) {
          // Ignorar erros de verificação
        }
      }
      
      setFunnels(funnelsWithData);
      calculateStats(funnelsWithData);
      
      // Incrementar kanbanKey após carregar para forçar re-render
      setKanbanKey(prev => prev + 1);
    } catch (error: any) {
      console.error("❌ [AdminWhatsappFunnel] Erro ao carregar funis:", error);
      
      let errorMessage = "Erro ao carregar funis do WhatsApp";
      
      if (error?.code === '42501' || error?.message?.includes('permission')) {
        errorMessage = "Sem permissão para acessar funis. Verifique as políticas RLS.";
      } else if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        errorMessage = "Tabelas do funil não foram criadas. Execute as migrations primeiro.";
      } else if (error?.message) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      setError(errorMessage);
      toast.error(errorMessage, {
        description: error?.code ? `Código: ${error.code}` : undefined,
        duration: 10000,
      });
      setFunnels([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (funnelsData: WhatsappFunnel[]) => {
    const total = funnelsData.length;
    const active = funnelsData.filter(f => f.funnel_status === 'active').length;
    
    const allMessages = funnelsData.flatMap(f => f.messages || []);
    const sent = allMessages.filter(m => m.status === 'sent').length;
    const failed = allMessages.filter(m => m.status === 'failed').length;
    
    const totalMessages = allMessages.length;
    const conversionRate = totalMessages > 0 ? ((sent / totalMessages) * 100) : 0;

    setStats({ total, active, sent, failed, conversionRate });
  };

  // Filtrar funis
  const filteredFunnels = useMemo(() => {
    let filtered = funnels;

    if (searchTerm) {
      filtered = filtered.filter(
        (funnel) =>
          funnel.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          funnel.customer_whatsapp?.includes(searchTerm) ||
          funnel.order_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(funnel => {
        // Usar source_table como prioridade para filtro também
        if (funnel.source_table) {
          if (statusFilter === 'pending') return funnel.source_table === 'pending';
          if (statusFilter === 'completed') return funnel.source_table === 'completed';
          if (statusFilter === 'exited') return funnel.source_table === 'exited';
        }
        
        // Fallback para lógica de negócio
        const orderStatus = funnel.order?.status;
        const messagesSent = funnel.messages?.filter(m => m.status === 'sent').length || 0;
        const isExited = funnel.funnel_status === 'exited' || (messagesSent >= 4 && orderStatus === 'pending');
        const isCompleted = orderStatus === 'paid';
        
        if (statusFilter === 'completed') return isCompleted;
        if (statusFilter === 'exited') return isExited;
        if (statusFilter === 'pending') return !isCompleted && !isExited;
        return true;
      });
    }

    // Filtrar apenas por WhatsApp válido - NÃO filtrar por is_paused
    const result = filtered.filter(f => f.customer_whatsapp && f.customer_whatsapp.trim().length > 0);
    
    return result;
  }, [funnels, searchTerm, statusFilter]);

  // Agrupar por status para Kanban (3 colunas: Pendente, Completo, Saiu)
  // IMPORTANTE: Priorizar funnel_status sobre outras condições para garantir movimento visual
  // Usar useMemo com dependências explícitas para garantir recálculo
  const kanbanColumns = useMemo(() => {
    const columns = {
      pending: [] as WhatsappFunnel[],
      completed: [] as WhatsappFunnel[],
      exited: [] as WhatsappFunnel[],
    };

    filteredFunnels.forEach(funnel => {
      // PRIORIDADE 1: Usar source_table para determinar a coluna (mais confiável)
      // source_table é definido quando carregamos os funis das tabelas separadas
      // IMPORTANTE: Todos os funis de whatsapp_funnel_pending devem aparecer em "Pendente"
      // independente de is_paused ou outras condições
      if (funnel.source_table) {
        if (funnel.source_table === 'pending') {
          columns.pending.push(funnel);
          return; // IMPORTANTE: return para evitar processamento adicional
        } else if (funnel.source_table === 'completed') {
          columns.completed.push(funnel);
          return;
        } else if (funnel.source_table === 'exited') {
          columns.exited.push(funnel);
          return;
        }
      }
      
      // PRIORIDADE 2: Fallback usando lógica de negócio se source_table não estiver disponível
      // Mas NUNCA usar is_paused para esconder funis - apenas para controle de processamento
      const orderStatus = funnel.order?.status;
      const messagesSent = funnel.messages?.filter(m => m.status === 'sent').length || 0;
      
      if (funnel.funnel_status === 'exited') {
        columns.exited.push(funnel);
      } else if (orderStatus === 'paid') {
        columns.completed.push(funnel);
      } else if (messagesSent >= 3 && orderStatus === 'pending') {
        columns.exited.push(funnel);
      } else {
        // Por padrão, colocar em pending se não houver outras condições
        // IMPORTANTE: Não filtrar por is_paused aqui - funis pausados também aparecem
        columns.pending.push(funnel);
      }
    });
    
    // Verificar se funis exited estão sendo agrupados corretamente
    const exitedInFiltered = filteredFunnels.filter(f => f.funnel_status === 'exited');
    if (exitedInFiltered.length > 0 && columns.exited.length !== exitedInFiltered.length) {
      console.error('DISCREPÂNCIA: Funis exited não estão sendo agrupados corretamente!', {
        totalExited: exitedInFiltered.length,
        exitedInColumn: columns.exited.length,
      });
    }

    // Retornar novo objeto para garantir que React detecte a mudança
    return {
      pending: [...columns.pending],
      completed: [...columns.completed],
      exited: [...columns.exited],
    };
  }, [filteredFunnels, kanbanKey]);

  const formatWhatsapp = (whatsapp: string) => {
    if (!whatsapp) return 'Sem WhatsApp';
    const cleaned = whatsapp.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return whatsapp;
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleDragStart = (e: React.DragEvent, funnel: WhatsappFunnel) => {
    setDraggedFunnel(funnel);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', funnel.id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Limpar estados apenas se não houver drop em andamento
    setTimeout(() => {
      setDraggedFunnel(null);
      setDragOverColumn(null);
    }, 100);
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnStatus);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Só limpar se realmente saiu da coluna (não apenas de um filho)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Se o mouse ainda está dentro da área da coluna, não limpar
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return;
    }
    
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedFunnel) return;

    const funnelId = e.dataTransfer.getData('text/plain');
    if (funnelId !== draggedFunnel.id) return;

    // Não permitir mover se já está na mesma coluna
    const currentOrderStatus = draggedFunnel.order?.status;
    const currentMessagesSent = draggedFunnel.messages?.filter(m => m.status === 'sent').length || 0;
    const isCurrentlyExited = draggedFunnel.funnel_status === 'exited' || (currentMessagesSent >= 3 && currentOrderStatus === 'pending');
    const isCurrentlyCompleted = currentOrderStatus === 'paid';
    
    let currentColumn = 'pending';
    if (isCurrentlyCompleted) currentColumn = 'completed';
    else if (isCurrentlyExited) currentColumn = 'exited';
    
    if (currentColumn === targetStatus) {
      setDraggedFunnel(null);
      return;
    }

    // Determinar novo status baseado na coluna
    let newStatus: string;
    let updateData: any = {};

    if (targetStatus === 'pending') {
      // Reativar funil - voltar para ativo
      newStatus = 'active';
      updateData = {
        funnel_status: 'active',
        exit_reason: null,
        next_message_at: null, // ENVIO IMEDIATO: null = enviar na próxima execução do cron
        current_step: 1, // Reiniciar passo
      };
    } else if (targetStatus === 'completed') {
      // Permitir mover para completo se vier de "exited" (Saiu)
      // Isso permite marcar manualmente funis que saíram mas que o cliente completou o pagamento depois
      if (currentColumn === 'exited') {
        newStatus = 'completed';
        updateData = {
          funnel_status: 'completed',
          exit_reason: null, // Limpar exit_reason ao marcar como completo
          next_message_at: null, // Não processar mais mensagens
        };
      } else {
        // Não permitir mover de "pending" para "completed" diretamente
        toast.error('Não é possível mover para "Completo" manualmente. O status muda automaticamente quando o pedido é pago.');
        setDraggedFunnel(null);
        return;
      }
    } else if (targetStatus === 'exited') {
      // Marcar como saiu - não processará mais mensagens
      newStatus = 'exited';
      updateData = {
        funnel_status: 'exited',
        exit_reason: 'manual',
        next_message_at: null, // Não processar mais mensagens
      };
      
      // Cancelar mensagens pendentes
      try {
        await supabase
          .from('whatsapp_messages')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('funnel_id', draggedFunnel.id)
          .eq('status', 'pending');
      } catch (cancelError) {
        console.error('Erro ao cancelar mensagens pendentes:', cancelError);
      }
    } else {
      setDraggedFunnel(null);
      return;
    }

    // Salvar o funil original para possível reversão
    const originalFunnel = draggedFunnel;
    
    try {
      console.log(`🔄 [AdminWhatsappFunnel] Movendo funil ${draggedFunnel.id} para ${targetStatus}`);
      
      // Usar funções SQL para mover entre tabelas
      let moveResult;
      if (targetStatus === 'pending') {
        const { data, error } = await supabase.rpc('move_funnel_to_pending', {
          p_funnel_id: draggedFunnel.id
        });
        moveResult = { data, error };
      } else if (targetStatus === 'completed') {
        // Mover para completed (permitido apenas se vier de "exited")
        const { data, error } = await supabase.rpc('move_funnel_to_completed', {
          p_funnel_id: draggedFunnel.id
        });
        moveResult = { data, error };
      } else if (targetStatus === 'exited') {
        const { data, error } = await supabase.rpc('move_funnel_to_exited', {
          p_funnel_id: draggedFunnel.id,
          p_exit_reason: updateData.exit_reason || 'manual'
        });
        moveResult = { data, error };
      } else {
        throw new Error(`Status de destino inválido: ${targetStatus}`);
      }

      if (moveResult.error) {
        console.error('❌ [AdminWhatsappFunnel] Erro ao mover funil:', moveResult.error);
        throw moveResult.error;
      }

      // As funções retornam UUID diretamente, não um objeto
      const returnedId = moveResult.data;

      // Atualização otimista: atualizar estado local após sucesso no banco
      // Usar flushSync para garantir atualização síncrona antes de incrementar kanbanKey
      flushSync(() => {
        setFunnels(prevFunnels => {
          const updated = prevFunnels.map(funnel => {
            if (funnel.id === draggedFunnel.id) {
              const updatedFunnel = {
                ...funnel,
                funnel_status: newStatus as any,
                exit_reason: updateData.exit_reason || null,
                updated_at: new Date().toISOString(),
                source_table: targetStatus as 'pending' | 'completed' | 'exited',
              };
              return updatedFunnel;
            }
            return funnel;
          });
          // Retornar novo array para garantir que React detecte a mudança
          return [...updated];
        });
      });
      
      // Incrementar kanbanKey diretamente após flushSync garantir que setFunnels foi processado
      setKanbanKey(prev => prev + 1);
      
      // Limpar estados de drag imediatamente
      setDraggedFunnel(null);
      setDragOverColumn(null);

      const statusLabel = targetStatus === 'pending' ? 'Pendente' : targetStatus === 'exited' ? 'Saiu' : 'Completo';
      toast.success(`Funil movido para "${statusLabel}"`);
      
      if (targetStatus === 'exited') {
        toast.info('Funil marcado como "Saiu". Não receberá mais mensagens automáticas.');
      } else if (targetStatus === 'pending') {
        toast.info('Funil reativado. Receberá mensagens automáticas novamente.');
      } else if (targetStatus === 'completed') {
        toast.info('Funil marcado como "Completo". O cliente completou o pagamento.');
      }
      
      // NÃO recarregar imediatamente após drag and drop
      // A atualização otimista já atualizou o estado local
      // O usuário pode atualizar manualmente quando quiser
      // Isso evita que a página volte ao topo
    } catch (error: any) {
      console.error('❌ [AdminWhatsappFunnel] Erro ao mover funil:', error);
      toast.error(`Erro ao mover funil: ${error.message}`);
      
      // Reverter atualização otimista em caso de erro
      setFunnels(prevFunnels => {
        return prevFunnels.map(funnel => {
          if (funnel.id === originalFunnel.id) {
            return originalFunnel;
          }
          return funnel;
        });
      });
      
      // Não recarregar automaticamente - usuário pode atualizar manualmente
      // Isso evita que a página volte ao topo após erro
    }
  };

  // Função para disparar mensagem de checkout individual
  const sendCheckoutMessage = async (funnel: WhatsappFunnel) => {
    // Validar antes de enviar
    const validation = await validateFunnelForSending(funnel);
    if (!validation.valid) {
      toast.error(`Não é possível disparar: ${validation.reason}`);
      return;
    }

    setSendingFunnels(prev => new Set(prev).add(funnel.id));

    try {
      // ⚠️ VALIDAÇÃO CRÍTICA: Verificar se pedido tem URL da Cakto antes de enviar
      const { data: orderCheck, error: orderCheckError } = await supabase
        .from('orders')
        .select('id, customer_email, customer_whatsapp, cakto_payment_url, quiz_id')
        .eq('id', funnel.order_id)
        .single();
      
      if (orderCheck) {
        // ⚠️ VALIDAÇÃO: Se URL salva é do checkout interno, gerar nova URL da Cakto
        if (orderCheck.cakto_payment_url && 
            orderCheck.cakto_payment_url.includes('musiclovely.com') && 
            orderCheck.cakto_payment_url.includes('/checkout')) {
          // Buscar idioma do quiz
          const quizId = funnel.quiz_id || orderCheck.quiz_id;
          
          if (!quizId) {
            throw new Error(`Não foi possível encontrar quiz_id para o pedido ${funnel.order_id}`);
          }
          
          const { data: quiz } = await supabase
            .from('quizzes')
            .select('language')
            .eq('id', quizId)
            .single();
          
          const language = quiz?.language || 'pt';
          
          // Gerar URL da Cakto correta
          const newCaktoUrl = generateCaktoUrl(
            orderCheck.id,
            orderCheck.customer_email || '',
            orderCheck.customer_whatsapp || '',
            language
          );
          
          // Validar URL gerada
          if (!newCaktoUrl.startsWith('https://pay.cakto.com.br')) {
            throw new Error(`URL da Cakto gerada é inválida: ${newCaktoUrl.substring(0, 100)}`);
          }
          
          // Salvar URL correta no banco
          await supabase
            .from('orders')
            .update({ cakto_payment_url: newCaktoUrl })
            .eq('id', funnel.order_id);
        }
      }
      
      // Garantir checkout links
      const linksResult = await ensureCheckoutLinks(funnel.order_id);
      
      // ⚠️ VALIDAÇÃO FINAL: Verificar se URL da Cakto está correta antes de enviar
      if (linksResult.caktoUrl) {
        if (!linksResult.caktoUrl.startsWith('https://pay.cakto.com.br')) {
          throw new Error(`URL da Cakto retornada não é válida: ${linksResult.caktoUrl.substring(0, 100)}`);
        }
        
        if (linksResult.caktoUrl.includes('musiclovely.com') && linksResult.caktoUrl.includes('/checkout')) {
          throw new Error(`URL da Cakto retornada é do checkout interno: ${linksResult.caktoUrl.substring(0, 100)}`);
        }
      }

      // Usar send-checkout-link (função confiável e já testada)
      // Chamar Edge Function com tratamento de erro melhorado
      const result = await supabase.functions.invoke('send-checkout-link', {
        body: {
          order_id: funnel.order_id,
        },
      }) as { data: any; error: any };

      // PRIORIDADE 1: Verificar se há erro HTTP (result.error)
      if (result?.error) {
        console.error('❌ [AdminWhatsappFunnel] Erro HTTP detectado:', result.error);
        
        // Tentar extrair mensagem de erro do result.data primeiro (pode conter mensagem mais detalhada)
        let errorMessage = 'Erro ao disparar mensagem';
        let errorStatus = null;
        let errorContext = null;
        let orderId = null;
        
        // Tentar obter mensagem do data se disponível (Edge Function pode retornar erro no data)
        if (result.data) {
          if (result.data.error) {
            errorMessage = result.data.error;
          }
          if (result.data.context) {
            errorContext = result.data.context;
          }
          if (result.data.order_id) {
            orderId = result.data.order_id;
          }
        }
        
        // Se não encontrou no data, tentar no error
        if (errorMessage === 'Erro ao disparar mensagem') {
          if (result.error.message) {
            errorMessage = result.error.message;
          } else if (typeof result.error === 'string') {
            errorMessage = result.error;
          } else if (result.error.error) {
            errorMessage = result.error.error;
          }
        }
        
        if (result.error.status) {
          errorStatus = result.error.status;
        } else if (result.data?.status) {
          errorStatus = result.data.status;
        }
        
        if (!errorContext && result.error.context) {
          errorContext = result.error.context;
        }
        
        console.error('❌ [AdminWhatsappFunnel] Detalhes completos do erro:', {
          message: errorMessage,
          status: errorStatus,
          context: errorContext,
          order_id: orderId || funnel.order_id,
          fullError: result.error,
          data: result.data,
        });
        
        // Mensagem de erro mais informativa
        let finalErrorMessage = errorMessage;
        if (errorContext) {
          finalErrorMessage = `${errorMessage} (${errorContext})`;
        }
        if (errorStatus) {
          if (errorStatus === 400) {
            finalErrorMessage = `Erro de validação (400): ${errorMessage}${errorContext ? ` - ${errorContext}` : ''}. Verifique se o pedido tem WhatsApp e quiz válidos.`;
          } else if (errorStatus === 404) {
            finalErrorMessage = `Pedido não encontrado (404): ${errorMessage}${errorContext ? ` - ${errorContext}` : ''}`;
          } else if (errorStatus === 500) {
            finalErrorMessage = `Erro interno do servidor (500): ${errorMessage}${errorContext ? ` - ${errorContext}` : ''}. Verifique os logs da Edge Function.`;
          } else {
            finalErrorMessage = `Erro ${errorStatus}: ${errorMessage}${errorContext ? ` - ${errorContext}` : ''}`;
          }
        }
        
        throw new Error(finalErrorMessage);
      }

      // PRIORIDADE 2: Verificar se data existe
      if (!result?.data) {
        console.error('❌ [AdminWhatsappFunnel] Resposta do servidor está vazia');
        throw new Error('Resposta do servidor está vazia. Verifique os logs da Edge Function.');
      }

      // PRIORIDADE 3: Verificar success === false ANTES de acessar outras propriedades
      if (result.data.success === false) {
        const errorMsg = result.data.error || 'Falha ao enviar mensagem';
        const errorContext = result.data.context || '';
        console.error('❌ [AdminWhatsappFunnel] Função retornou success: false:', {
          error: errorMsg,
          context: errorContext,
          order_id: result.data.order_id || funnel.order_id,
          fullResponse: result.data,
        });
        throw new Error(errorContext ? `${errorMsg} - ${errorContext}` : errorMsg);
      }

      // PRIORIDADE 4: Verificar se há erro na resposta mesmo sem success: false
      if (result.data.error && result.data.success !== true) {
        const errorContext = result.data.context || '';
        console.error('❌ [AdminWhatsappFunnel] Erro na resposta:', {
          error: result.data.error,
          context: errorContext,
          order_id: result.data.order_id || funnel.order_id,
        });
        throw new Error(errorContext ? `${result.data.error} - ${errorContext}` : result.data.error);
      }
      
      // Sucesso!
      toast.success('Mensagem de checkout enviada com sucesso!');
      
      // Atualizar estado local
      setFunnels(prev => prev.map(f => {
        if (f.id === funnel.id) {
          return {
            ...f,
            messages: [
              ...(f.messages || []),
              {
                id: `temp-${Date.now()}`,
                funnel_id: f.id,
                message_type: 'checkout_link',
                message_text: '',
                status: 'sent',
                created_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
              } as any,
            ],
          };
        }
        return f;
      }));
    } catch (error: any) {
      console.error('❌ [AdminWhatsappFunnel] Erro completo ao disparar mensagem:', {
        error,
        error_message: error.message,
        error_stack: error.stack,
        funnel_id: funnel.id,
        order_id: funnel.order_id,
      });
      
      // Extrair mensagem de erro de forma mais robusta
      let errorMessage = 'Erro desconhecido ao disparar mensagem';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      }
      
      // Mostrar toast com mensagem de erro
      toast.error(`Erro ao disparar: ${errorMessage}`, {
        description: `Pedido: ${funnel.order_id?.substring(0, 8)}...`,
        duration: 5000,
      });
      
      // Logs adicionais para debug
      console.error('💡 [AdminWhatsappFunnel] Informações para debug:', {
        funnel_id: funnel.id,
        order_id: funnel.order_id,
        has_whatsapp: !!funnel.customer_whatsapp,
        has_quiz: !!funnel.quiz_id,
        error_type: error.constructor?.name || typeof error,
      });
      
      // Dicas específicas baseadas no tipo de erro
      if (error.message?.includes('Edge Function')) {
        console.error('💡 Dica: Verifique se a Edge Function send-checkout-link está deployada no Supabase');
      } else if (error.message?.includes('WhatsApp')) {
        console.error('💡 Dica: Verifique se o pedido tem um número de WhatsApp válido');
      } else if (error.message?.includes('quiz')) {
        console.error('💡 Dica: Verifique se o pedido tem um quiz associado');
      }
    } finally {
      setSendingFunnels(prev => {
        const updated = new Set(prev);
        updated.delete(funnel.id);
        return updated;
      });
    }
  };

  // Função para disparar passo específico do funil
  const dispatchFunnelStep = async (funnelId: string, step: number) => {
    try {
      setSendingFunnels(prev => new Set([...prev, funnelId]));
      toast.info(`Disparando passo ${step}...`);

      // Verificar autenticação antes de chamar
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Usuário não autenticado:', authError);
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const { data, error } = await supabase.functions.invoke('dispatch-funnel-step', {
        body: {
          funnel_id: funnelId,
          step: step
        },
        headers: authToken ? {
          Authorization: `Bearer ${authToken}`
        } : undefined
      });


      if (error) {
        console.error('❌ [AdminWhatsappFunnel] Erro detalhado:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          context: error.context
        });
        
        let errorMessage = error.message || 'Erro desconhecido';
        if (error.status === 404) {
          errorMessage = 'Função não encontrada. A função precisa ser deployada no Supabase.';
        } else if (error.status === 401) {
          errorMessage = 'Não autenticado. Faça login novamente.';
        } else if (error.status === 403) {
          errorMessage = 'Acesso negado. Você precisa ter permissão de administrador.';
        } else if (error.status === 500) {
          errorMessage = 'Erro interno do servidor. Verifique os logs da Edge Function.';
        }
        throw new Error(errorMessage);
      }

      if (data?.success) {
        toast.success(`Passo ${step} enviado com sucesso!`);
        loadFunnels();
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('❌ [AdminWhatsappFunnel] Erro completo ao disparar passo:', {
        funnelId,
        step,
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      toast.error(`Erro ao disparar passo ${step}: ${error.message || 'Erro desconhecido'}`, {
        duration: 8000,
        description: 'Verifique o console para mais detalhes'
      });
    } finally {
      setSendingFunnels(prev => {
        const newSet = new Set(prev);
        newSet.delete(funnelId);
        return newSet;
      });
    }
  };

  // Função para disparar todos os funis pendentes
  const dispatchAllPendingFunnels = async () => {
    if (!confirm('Disparar todos os funis pendentes? Isso processará um por vez.')) {
      return;
    }

    setSendingBulk(true);
    setBulkProgress({ current: 0, total: 0 });

    try {
      toast.info('Disparando todos os funis pendentes...');

      console.log('📤 [AdminWhatsappFunnel] Chamando dispatch-all-pending-funnels...');
      console.log('🔍 [AdminWhatsappFunnel] Supabase URL:', supabase.supabaseUrl);
      console.log('🔍 [AdminWhatsappFunnel] Verificando autenticação...');
      
      // Verificar se usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ [AdminWhatsappFunnel] Usuário não autenticado:', authError);
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      console.log('✅ [AdminWhatsappFunnel] Usuário autenticado:', user.id);

      const { data, error } = await supabase.functions.invoke('dispatch-all-pending-funnels', {
        body: {}
      });

      console.log('📥 [AdminWhatsappFunnel] Resposta recebida:', {
        hasData: !!data,
        hasError: !!error,
        data: data,
        error: error
      });

      if (error) {
        console.error('❌ [AdminWhatsappFunnel] Erro detalhado:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          context: error.context,
          name: error.name,
          stack: error.stack
        });
        
        // Mensagem de erro mais detalhada
        let errorMessage = error.message || 'Erro desconhecido';
        
        if (error.status === 404) {
          errorMessage = 'Função não encontrada. A função "dispatch-all-pending-funnels" precisa ser deployada no Supabase.';
        } else if (error.status === 401) {
          errorMessage = 'Não autenticado. Faça login novamente.';
        } else if (error.status === 403) {
          errorMessage = 'Acesso negado. Você precisa ter permissão de administrador.';
        } else if (error.status === 500) {
          errorMessage = 'Erro interno do servidor. Verifique os logs da Edge Function.';
        } else if (error.message?.includes('Failed to send')) {
          errorMessage = 'Falha ao conectar com a Edge Function. Verifique se a função está deployada e se há problemas de rede.';
        }
        
        throw new Error(errorMessage);
      }

      if (data?.success) {
        setBulkProgress({ current: data.processed || 0, total: data.total_found || 0 });
        toast.success(`${data.processed || 0} funil(is) processado(s) com sucesso!`);
        if (data.errors_count > 0) {
          toast.warning(`${data.errors_count} funil(is) falharam`);
        }
        loadFunnels();
      } else {
        throw new Error(data?.error || 'Erro ao processar funis');
      }
    } catch (error: any) {
      console.error('❌ [AdminWhatsappFunnel] Erro completo ao disparar todos os funis:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause
      });
      
      const errorMessage = error.message || 'Erro desconhecido';
      toast.error(`Erro ao disparar: ${errorMessage}`, {
        duration: 10000,
        description: 'Verifique o console para mais detalhes'
      });
    } finally {
      setSendingBulk(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  // Função para disparar em massa (mantida para compatibilidade)
  const sendBulkCheckoutMessages = async () => {
    // Filtrar funis elegíveis
    const eligibleFunnels = filteredFunnels.filter(f => 
      f.source_table === 'pending' && 
      !f.is_paused &&
      f.order?.status === 'pending'
    );

    if (eligibleFunnels.length === 0) {
      toast.info('Nenhum funil elegível para disparo');
      return;
    }

    // Validar cada funil
    const validFunnels: WhatsappFunnel[] = [];
    for (const funnel of eligibleFunnels) {
      const validation = await validateFunnelForSending(funnel);
      if (validation.valid) {
        validFunnels.push(funnel);
      }
    }

    if (validFunnels.length === 0) {
      toast.warning('Nenhum funil passou na validação');
      return;
    }

    if (!confirm(`Disparar mensagem de checkout para ${validFunnels.length} funil(is)?`)) {
      return;
    }

    setSendingBulk(true);
    setBulkProgress({ current: 0, total: validFunnels.length });
    setSendingFunnels(new Set(validFunnels.map(f => f.id)));

    try {
      // ⚠️ VALIDAÇÃO CRÍTICA: Verificar e garantir URLs da Cakto para todos os funis
      console.log('🔍 [AdminWhatsappFunnel] Verificando URLs da Cakto para todos os funis...');
      
      for (const funnel of validFunnels) {
        // Verificar URL salva no banco
        const { data: order } = await supabase
          .from('orders')
          .select('id, customer_email, customer_whatsapp, cakto_payment_url, quiz_id')
          .eq('id', funnel.order_id)
          .single();
        
        if (order) {
          // Se URL salva é do checkout interno, gerar nova
          if (order.cakto_payment_url && 
              order.cakto_payment_url.includes('musiclovely.com') && 
              order.cakto_payment_url.includes('/checkout')) {
            console.warn(`⚠️ [AdminWhatsappFunnel] Funil ${funnel.id}: URL salva é do checkout interno, gerando nova...`);
            
            // Buscar idioma do quiz
            const { data: quiz } = await supabase
              .from('quizzes')
              .select('language')
              .eq('id', order.quiz_id)
              .single();
            
            const language = quiz?.language || 'pt';
            
            // Gerar URL da Cakto correta
            const newCaktoUrl = generateCaktoUrl(
              order.id,
              order.customer_email || '',
              order.customer_whatsapp || '',
              language
            );
            
            // Validar e salvar
            if (newCaktoUrl.startsWith('https://pay.cakto.com.br')) {
              await supabase
                .from('orders')
                .update({ cakto_payment_url: newCaktoUrl })
                .eq('id', funnel.order_id);
              
              console.log(`✅ [AdminWhatsappFunnel] Funil ${funnel.id}: URL da Cakto corrigida`);
            }
          }
        }
      }
      
      // Garantir checkout links para todos
      console.log('🔍 [AdminWhatsappFunnel] Garantindo checkout links para todos os funis...');
      await Promise.all(validFunnels.map(async (f) => {
        const linksResult = await ensureCheckoutLinks(f.order_id);
        
        // ⚠️ VALIDAÇÃO: Verificar se URL da Cakto está correta
        if (linksResult.caktoUrl) {
          if (!linksResult.caktoUrl.startsWith('https://pay.cakto.com.br')) {
            console.error(`❌ [AdminWhatsappFunnel] Funil ${f.id}: URL da Cakto inválida:`, linksResult.caktoUrl.substring(0, 100));
            throw new Error(`URL da Cakto inválida para funil ${f.id}`);
          }
          
          if (linksResult.caktoUrl.includes('musiclovely.com') && linksResult.caktoUrl.includes('/checkout')) {
            console.error(`❌ [AdminWhatsappFunnel] Funil ${f.id}: URL da Cakto é do checkout interno:`, linksResult.caktoUrl.substring(0, 100));
            throw new Error(`URL da Cakto é do checkout interno para funil ${f.id}`);
          }
        }
        
        return linksResult;
      }));
      
      console.log('✅ [AdminWhatsappFunnel] Todos os checkout links validados e garantidos');

      // Enviar mensagens individualmente usando send-checkout-link
      let sent = 0;
      let failed = 0;

      for (const funnel of validFunnels) {
        try {
          const { error: sendError } = await supabase.functions.invoke('send-checkout-link', {
            body: {
              order_id: funnel.order_id,
              funnel_id: funnel.id
            }
          });

          if (sendError) {
            console.error(`Erro ao enviar mensagem para funnel ${funnel.id}:`, sendError);
            failed++;
          } else {
            sent++;
          }

          setBulkProgress({ current: sent + failed, total: validFunnels.length });

          // Delay entre mensagens (3-6 segundos)
          const delay = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (err) {
          console.error(`Erro ao enviar mensagem para funnel ${funnel.id}:`, err);
          failed++;
        }
      }

      if (sent > 0) {
        toast.success(`${sent} mensagem(ns) enviada(s) com sucesso!`);
        if (failed > 0) {
          toast.warning(`${failed} mensagem(ns) falharam`);
        }
      } else {
        toast.warning('Nenhuma mensagem foi enviada');
      }
    } catch (error: any) {
      console.error('Erro ao disparar em massa:', error);
      toast.error(`Erro ao disparar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSendingBulk(false);
      setBulkProgress({ current: 0, total: 0 });
      setTimeout(() => {
        setSendingFunnels(new Set());
      }, 2000);
    }
  };

  const FunnelCard = ({ funnel }: { funnel: WhatsappFunnel }) => {
    const orderStatus = funnel.order?.status;
    const isMovingToCompleted = movingToCompleted.has(funnel.id);
    const isSending = sendingFunnels.has(funnel.id);
    
    // Verificar se já recebeu mensagem de checkout
    const hasCheckoutMessage = funnel.messages?.some(m => 
      m.message_type === 'checkout_link' && m.status === 'sent'
    ) || false;
    
    // Calcular contadores de mensagens
    const messagesSent = funnel.messages?.filter(m => m.status === 'sent').length || 0;
    const messagesFailed = funnel.messages?.filter(m => m.status === 'failed').length || 0;
    const messagesPending = funnel.messages?.filter(m => m.status === 'pending').length || 0;
    const totalMessages = funnel.messages?.length || 0;
    
    const isExited = funnel.funnel_status === 'exited' || (messagesSent >= 4 && orderStatus === 'pending');
    const isCompleted = orderStatus === 'paid';

    const handleReactivate = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Reativar este funil para enviar novas mensagens?')) return;
      
      try {
        const { data, error } = await supabase.rpc('move_funnel_to_pending', {
          p_funnel_id: funnel.id
        });

        if (error) {
          console.error('❌ [AdminWhatsappFunnel] Erro ao reativar funil:', error);
          throw error;
        }
        
        console.log('✅ [AdminWhatsappFunnel] Funil reativado:', { funnel_id: data });
        toast.success('Funil reativado!');
        loadFunnels();
      } catch (error: any) {
        console.error('❌ [AdminWhatsappFunnel] Erro completo ao reativar:', error);
        toast.error(`Erro ao reativar: ${error.message || 'Erro desconhecido'}`);
      }
    };

    const isDragging = draggedFunnel?.id === funnel.id;

    return (
      <Card 
        className={`mb-1 hover:shadow-md transition-all cursor-move min-h-[120px] flex flex-col ${isDragging ? 'opacity-50 scale-95' : 'cursor-pointer'} ${isMovingToCompleted ? 'ring-2 ring-green-500 bg-green-50/30 animate-pulse' : ''}`}
        onClick={() => !isDragging && setSelectedFunnel(funnel)}
        draggable={!isMovingToCompleted}
        onDragStart={(e) => {
          if (isMovingToCompleted) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          handleDragStart(e, funnel);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          handleDragEnd(e);
        }}
      >
        <CardContent className="p-1.5 flex-1 flex flex-col">
          {/* Indicador visual de movimento para completed */}
          {isMovingToCompleted && (
            <div className="mb-1 p-1 bg-green-100 border border-green-300 rounded text-[9px] text-green-700 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 shrink-0 animate-spin" />
              <span className="leading-tight">Pedido pago detectado! Movendo para "Completo"...</span>
            </div>
          )}
          
          <div className="space-y-1 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-1 mb-0.5">
                  <Phone className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-medium break-words leading-tight overflow-wrap-anywhere">{funnel.customer_whatsapp}</span>
                </div>
                <div className="flex items-center gap-1 mb-0.5">
                  <Mail className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground break-words leading-tight overflow-wrap-anywhere">{funnel.customer_email}</span>
                </div>
              </div>
              <Badge className={`${isCompleted ? 'bg-green-600' : isExited ? 'bg-orange-600' : 'bg-blue-600'} shrink-0 text-[10px] px-1 py-0`}>
                {isCompleted ? 'Completo' : isExited ? 'Saiu' : 'Pendente'}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{funnel.order_id.slice(0, 8)}...</span>
              <span>{funnel.order ? formatCurrency(funnel.order.amount_cents) : '-'}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Passo {funnel.current_step}/4</span>
              <span>{messagesSent} enviadas</span>
            </div>

            {/* Idioma e próximo passo */}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" />
                {funnel.quiz?.language === 'en' ? '🇺🇸 EN' : funnel.quiz?.language === 'es' ? '🇪🇸 ES' : '🇧🇷 PT'}
              </span>
              {funnel.next_message_at && !isCompleted && !isExited && (
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {(() => {
                    const nextDate = new Date(funnel.next_message_at);
                    const now = new Date();
                    const diffMs = nextDate.getTime() - now.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    if (diffMins <= 0) return 'Agora';
                    if (diffMins < 60) return `${diffMins}min`;
                    const diffHours = Math.floor(diffMins / 60);
                    if (diffHours < 24) return `${diffHours}h`;
                    return `${Math.floor(diffHours / 24)}d`;
                  })()}
                </span>
              )}
            </div>

            {/* Tags de status das mensagens */}
            {totalMessages > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {messagesSent > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                    {messagesSent} sucesso
                  </Badge>
                )}
                {messagesFailed > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    {messagesFailed} erro
                  </Badge>
                )}
                {messagesPending > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    {messagesPending} pendente
                  </Badge>
                )}
              </div>
            )}

            {/* Botões de ação */}
            <div className="mt-1 space-y-1">
              {/* Botões de passo individual (1, 2, 3, 4) */}
              {!isCompleted && (
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px] px-1"
                    disabled={isSending || isMovingToCompleted || funnel.is_paused}
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await dispatchFunnelStep(funnel.id, 1);
                    }}
                  >
                    Passo 1
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px] px-1"
                    disabled={isSending || isMovingToCompleted || funnel.is_paused}
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await dispatchFunnelStep(funnel.id, 2);
                    }}
                  >
                    Passo 2
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px] px-1"
                    disabled={isSending || isMovingToCompleted || funnel.is_paused}
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await dispatchFunnelStep(funnel.id, 3);
                    }}
                  >
                    Passo 3
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px] px-1"
                    disabled={isSending || isMovingToCompleted || funnel.is_paused}
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await dispatchFunnelStep(funnel.id, 4);
                    }}
                  >
                    Passo 4
                  </Button>
                </div>
              )}

              {/* Botão Disparar (próximo passo automaticamente) */}
              {!isCompleted && !hasCheckoutMessage && (
                <Button
                  size="sm"
                  variant="default"
                  className="w-full h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSending || isMovingToCompleted || funnel.is_paused}
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await sendCheckoutMessage(funnel);
                  }}
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-3 w-3 mr-1" />
                      Disparar
                    </>
                  )}
                </Button>
              )}
              
              {/* Badge se já foi enviado */}
              {hasCheckoutMessage && (
                <div className="p-1 bg-green-50 border border-green-200 rounded text-[9px] text-green-700 flex items-center gap-1">
                  <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                  <span>Mensagem enviada</span>
                </div>
              )}

              {/* Botão Finalizar Agora - Abre checkout da Cakto */}
              {!isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-6 text-[10px] border-green-300 text-green-700 hover:bg-green-50"
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      console.group('🔗 [AdminWhatsappFunnel] AUDITORIA: Abrindo checkout da Cakto');
                      console.log('📋 Pedido ID:', funnel.order_id);
                      
                      // Buscar dados do pedido
                      const { data: order, error: orderError } = await supabase
                        .from('orders')
                        .select('id, customer_email, customer_whatsapp, quiz_id, cakto_payment_url')
                        .eq('id', funnel.order_id)
                        .single();
                      
                      console.log('📦 Dados do pedido:', {
                        found: !!order,
                        error: orderError?.message,
                        hasEmail: !!order?.customer_email,
                        hasWhatsapp: !!order?.customer_whatsapp,
                        hasQuizId: !!order?.quiz_id,
                        caktoUrl_salva: order?.cakto_payment_url?.substring(0, 50) + '...',
                      });
                      
                      if (orderError || !order) {
                        throw new Error(`Pedido não encontrado: ${orderError?.message || 'N/A'}`);
                      }
                      
                      if (!order?.customer_email || !order?.customer_whatsapp) {
                        throw new Error(`Pedido sem email ou WhatsApp - Email: ${!!order.customer_email}, WhatsApp: ${!!order.customer_whatsapp}`);
                      }
                      
                      // Buscar idioma do quiz
                      const { data: quiz } = await supabase
                        .from('quizzes')
                        .select('language')
                        .eq('id', order.quiz_id)
                        .single();
                      
                      const language = quiz?.language || 'pt';
                      console.log('🌍 Idioma detectado:', language);
                      
                      // Verificar URL salva no banco (para debug)
                      if (order.cakto_payment_url) {
                        console.log('📝 URL da Cakto salva no banco:', {
                          url: order.cakto_payment_url,
                          startsWithCakto: order.cakto_payment_url.startsWith('https://pay.cakto.com.br'),
                          startsWithCheckout: order.cakto_payment_url.includes('musiclovely.com') && order.cakto_payment_url.includes('/checkout'),
                        });
                        
                        // Se a URL salva está incorreta (checkout interno), vamos gerar nova
                        if (order.cakto_payment_url.includes('musiclovely.com') && order.cakto_payment_url.includes('/checkout')) {
                          console.warn('⚠️ [AdminWhatsappFunnel] URL salva no banco está incorreta (checkout interno), gerando nova URL da Cakto');
                        }
                      }
                      
                      // SEMPRE gerar URL da Cakto (não usar a salva)
                      console.log('🔄 Gerando nova URL da Cakto...');
                      const caktoUrl = generateCaktoUrl(
                        order.id,
                        order.customer_email,
                        order.customer_whatsapp,
                        language
                      );
                      
                      // Validação detalhada
                      console.log('✅ URL gerada:', {
                        url: caktoUrl,
                        urlLength: caktoUrl.length,
                        startsWithCakto: caktoUrl.startsWith('https://pay.cakto.com.br'),
                        containsOrderId: caktoUrl.includes(order.id),
                        containsEmail: caktoUrl.includes(encodeURIComponent(order.customer_email)),
                        containsPhone: caktoUrl.includes(`phone=`), // ✅ CORREÇÃO: Verificar 'phone' ao invés de 'whatsapp'
                      });
                      
                      // Validar que a URL é da Cakto
                      if (!caktoUrl.startsWith('https://pay.cakto.com.br')) {
                        console.error('❌ [AdminWhatsappFunnel] URL inválida gerada:', caktoUrl);
                        console.error('❌ [AdminWhatsappFunnel] URL não começa com https://pay.cakto.com.br');
                        throw new Error(`URL inválida gerada: ${caktoUrl.substring(0, 100)}...`);
                      }
                      
                      // Verificar se não é checkout interno
                      if (caktoUrl.includes('musiclovely.com') && caktoUrl.includes('/checkout')) {
                        console.error('❌ [AdminWhatsappFunnel] URL gerada é do checkout interno, não da Cakto!');
                        throw new Error('URL gerada é do checkout interno ao invés da Cakto');
                      }
                      
                      console.log('🚀 [AdminWhatsappFunnel] Redirecionando para Cakto em 100ms...');
                      console.log('📍 URL completa:', caktoUrl);
                      console.groupEnd();
                      
                      // Mostrar URL no toast antes de redirecionar
                      toast.info(`Redirecionando para Cakto...`, {
                        description: `URL: ${caktoUrl.substring(0, 60)}...`,
                        duration: 2000,
                      });
                      
                      // Redirecionar diretamente após pequeno delay para garantir que logs apareçam
                      setTimeout(() => {
                        console.log('✅ [AdminWhatsappFunnel] Executando window.location.href =', caktoUrl);
                        window.location.href = caktoUrl;
                      }, 100);
                    } catch (error: any) {
                      console.error('❌ [AdminWhatsappFunnel] Erro completo:', error);
                      console.error('❌ [AdminWhatsappFunnel] Stack:', error.stack);
                      toast.error(`Erro: ${error.message || 'Erro desconhecido'}`);
                    }
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Finalizar Agora
                </Button>
              )}

              {/* Botão Play/Pause */}
              <Button
                size="sm"
                variant={funnel.is_paused ? "outline" : "default"}
                className={`w-full h-6 text-[10px] ${funnel.is_paused ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-300'}`}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onClick={async (e) => {
                  e.stopPropagation();
                  const newPausedState = !funnel.is_paused;
                  const action = newPausedState ? 'pausar' : 'retomar';
                  
                  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} o processamento deste funil?`)) return;
                  
                  try {
                    // Determinar tabela baseado em source_table
                    const tableName = funnel.source_table || 'pending';
                    
                    const { data, error } = await supabase.rpc('toggle_funnel_pause', {
                      p_funnel_id: funnel.id,
                      p_table_name: tableName
                    });
                    
                    if (error) {
                      console.error('❌ [AdminWhatsappFunnel] Erro ao alternar pause:', error);
                      throw error;
                    }
                    
                    if (data === null) {
                      throw new Error('Funil não encontrado');
                    }
                    
                    console.log(`✅ [AdminWhatsappFunnel] Funil ${newPausedState ? 'pausado' : 'retomado'}:`, { funnel_id: funnel.id, is_paused: data });
                    toast.success(`Funil ${newPausedState ? 'pausado' : 'retomado'} com sucesso!`);
                    
                    // Atualizar estado local imediatamente
                    setFunnels(prev => prev.map(f => 
                      f.id === funnel.id ? { ...f, is_paused: data as boolean } : f
                    ));
                    
                    // Não recarregar automaticamente - usuário pode atualizar manualmente
                    // Isso evita que a página volte ao topo
                  } catch (error: any) {
                    console.error('❌ [AdminWhatsappFunnel] Erro completo ao alternar pause:', error);
                    toast.error(`Erro ao ${action}: ${error.message || 'Erro desconhecido'}`);
                  }
                }}
              >
                {funnel.is_paused ? (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    Pausar
                  </>
                )}
              </Button>
            </div>

            {/* Botões para mover entre colunas */}
            {(isExited || isCompleted) && (
              <div className="mt-1 space-y-1">
                {isExited && (
                  <>
                    <div className="p-1 bg-orange-50 border border-orange-200 rounded text-[9px] text-orange-700">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                        <span className="leading-tight">Não receberá mais mensagens automáticas</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-6 text-[10px]"
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Mover este funil para "Pendente" e reativar envio de mensagens?')) return;
                        
                        try {
                          const { data, error } = await supabase.rpc('move_funnel_to_pending', {
                            p_funnel_id: funnel.id
                          });
                          
                          if (error) {
                            console.error('❌ [AdminWhatsappFunnel] Erro ao mover funil para pendente:', error);
                            throw error;
                          }
                          
                          console.log('✅ [AdminWhatsappFunnel] Funil movido para pendente:', { funnel_id: data });
                          toast.success('Funil movido para "Pendente" e reativado!');
                          loadFunnels();
                        } catch (error: any) {
                          console.error('❌ [AdminWhatsappFunnel] Erro completo ao mover funil:', error);
                          toast.error(`Erro ao mover funil: ${error.message || 'Erro desconhecido'}`);
                        }
                      }}
                    >
                      Mover para Pendente
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-6 text-[10px] bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Mover este funil para "Completo"?\n\nIsso marcará o funil como concluído.')) return;
                        
                        try {
                          const { data, error } = await supabase.rpc('move_funnel_to_completed', {
                            p_funnel_id: funnel.id
                          });
                          
                          if (error) {
                            console.error('❌ [AdminWhatsappFunnel] Erro ao mover funil para completo:', error);
                            throw error;
                          }
                          
                          console.log('✅ [AdminWhatsappFunnel] Funil movido para completo:', { funnel_id: data });
                          toast.success('Funil movido para "Completo"!');
                          toast.info('Funil marcado como "Completo". O cliente completou o pagamento.');
                          loadFunnels();
                        } catch (error: any) {
                          console.error('❌ [AdminWhatsappFunnel] Erro completo ao mover funil:', error);
                          toast.error(`Erro ao mover funil: ${error.message || 'Erro desconhecido'}`);
                        }
                      }}
                    >
                      Mover para Completo
                    </Button>
                  </>
                )}
                {isCompleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-6 text-[10px]"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('Mover este funil para "Pendente"?\n\nNota: O pedido já foi pago, mas você pode reativar o funil.')) return;
                      
                      try {
                        const { data, error } = await supabase.rpc('move_funnel_to_pending', {
                          p_funnel_id: funnel.id
                        });
                        
                        if (error) {
                          console.error('❌ [AdminWhatsappFunnel] Erro ao mover funil para pendente:', error);
                          throw error;
                        }
                        
                        console.log('✅ [AdminWhatsappFunnel] Funil movido para pendente:', { funnel_id: data });
                        toast.success('Funil movido para "Pendente"!');
                        loadFunnels();
                      } catch (error: any) {
                        console.error('❌ [AdminWhatsappFunnel] Erro completo ao mover funil:', error);
                        toast.error(`Erro ao mover funil: ${error.message || 'Erro desconhecido'}`);
                      }
                    }}
                  >
                    Mover para Pendente
                  </Button>
                )}
              </div>
            )}
            
            {/* Botão de excluir */}
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-6 text-[10px] mt-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={deletingFunnelId === funnel.id || isMovingToCompleted}
              draggable={false}
              onDragStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                console.log('🗑️ [AdminWhatsappFunnel] Botão excluir clicado para funil:', funnel.id);
                
                if (!confirm(`Tem certeza que deseja excluir o funil do cliente ${funnel.customer_email}?\n\nEsta ação irá:\n- Remover o funil do sistema\n- Remover todas as mensagens relacionadas\n\nEsta ação não pode ser desfeita.`)) {
                  console.log('❌ [AdminWhatsappFunnel] Exclusão cancelada pelo usuário');
                  return;
                }
                
                setDeletingFunnelId(funnel.id);
                
                try {
                  console.log(`🗑️ [AdminWhatsappFunnel] Iniciando exclusão do funil ${funnel.id}...`);
                  
                  // Determinar tabela baseada em source_table
                  const tableName = funnel.source_table || 'pending';
                  console.log(`📋 [AdminWhatsappFunnel] Tentando excluir da tabela: ${tableName}`);
                  
                  // Excluir mensagens primeiro
                  const { error: messagesError, count: messagesDeleted } = await supabase
                    .from('whatsapp_messages')
                    .delete({ count: 'exact' })
                    .eq('funnel_id', funnel.id);
                  
                  if (messagesError) {
                    console.warn(`⚠️ [AdminWhatsappFunnel] Erro ao excluir mensagens:`, messagesError);
                  } else {
                    console.log(`✅ [AdminWhatsappFunnel] ${messagesDeleted || 0} mensagem(ns) excluída(s)`);
                  }
                  
                  // Excluir o funil da tabela correta
                  let deleteError: any = null;
                  let deleteData: any = null;
                  
                  if (tableName === 'pending') {
                    const { data, error } = await supabase
                      .from('whatsapp_funnel_pending')
                      .delete()
                      .eq('id', funnel.id)
                      .select();
                    deleteError = error;
                    deleteData = data;
                  } else if (tableName === 'completed') {
                    const { data, error } = await supabase
                      .from('whatsapp_funnel_completed')
                      .delete()
                      .eq('id', funnel.id)
                      .select();
                    deleteError = error;
                    deleteData = data;
                  } else if (tableName === 'exited') {
                    const { data, error } = await supabase
                      .from('whatsapp_funnel_exited')
                      .delete()
                      .eq('id', funnel.id)
                      .select();
                    deleteError = error;
                    deleteData = data;
                  } else {
                    // Fallback: tentar todas as tabelas
                    console.log(`⚠️ [AdminWhatsappFunnel] source_table desconhecido (${tableName}), tentando todas as tabelas...`);
                    const deleteResults = await Promise.allSettled([
                      supabase.from('whatsapp_funnel_pending').delete().eq('id', funnel.id).select(),
                      supabase.from('whatsapp_funnel_completed').delete().eq('id', funnel.id).select(),
                      supabase.from('whatsapp_funnel_exited').delete().eq('id', funnel.id).select(),
                    ]);
                    
                    const successfulDelete = deleteResults.find(r => 
                      r.status === 'fulfilled' && 
                      r.value && 
                      !r.value.error &&
                      r.value.data && 
                      r.value.data.length > 0
                    );
                    
                    if (!successfulDelete) {
                      const criticalErrors = deleteResults.filter(r => 
                        r.status === 'fulfilled' && 
                        r.value?.error &&
                        r.value.error.code !== 'PGRST116'
                      );
                      
                      if (criticalErrors.length > 0) {
                        const firstError = criticalErrors[0];
                        if (firstError.status === 'fulfilled' && firstError.value?.error) {
                          throw firstError.value.error;
                        }
                      }
                      
                      console.warn(`⚠️ [AdminWhatsappFunnel] Funil não encontrado em nenhuma tabela`);
                    }
                  }
                  
                  if (deleteError) {
                    if (deleteError.code === 'PGRST116') {
                      console.warn(`⚠️ [AdminWhatsappFunnel] Funil não encontrado na tabela ${tableName} (pode já ter sido excluído)`);
                    } else {
                      throw deleteError;
                    }
                  }
                  
                  if (deleteData && deleteData.length > 0) {
                    console.log(`✅ [AdminWhatsappFunnel] Funil ${funnel.id} excluído com sucesso da tabela ${tableName}`);
                  }
                  
                  // Remover da lista imediatamente
                  setFunnels(prev => {
                    const filtered = prev.filter(f => f.id !== funnel.id);
                    console.log(`🔄 [AdminWhatsappFunnel] Funil removido da lista. Restam ${filtered.length} funis.`);
                    return filtered;
                  });
                  
                  // Fechar modal se estava aberto
                  if (selectedFunnel?.id === funnel.id) {
                    setSelectedFunnel(null);
                  }
                  
                  toast.success('Funil excluído com sucesso');
                  
                  // Não recarregar automaticamente - usuário pode atualizar manualmente
                  // Isso evita que a página volte ao topo
                } catch (error: any) {
                  console.error('❌ [AdminWhatsappFunnel] Erro completo ao excluir funil:', {
                    funnel_id: funnel.id,
                    source_table: funnel.source_table,
                    error: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                  });
                  toast.error(`Erro ao excluir funil: ${error.message || 'Erro desconhecido'}`);
                } finally {
                  setDeletingFunnelId(null);
                }
              }}
            >
              {deletingFunnelId === funnel.id ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ 
    title, 
    funnels, 
    status 
  }: { 
    title: string; 
    funnels: WhatsappFunnel[]; 
    status: string;
  }) => {
    const isDragOver = dragOverColumn === status;
    const isCompletedColumn = status === 'completed';

    return (
      <div 
        className="flex-1 min-w-[280px] max-w-[320px]"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isCompletedColumn) {
            handleDragOver(e, status);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDragLeave(e);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isCompletedColumn) {
            handleDrop(e, status);
          }
        }}
      >
        <Card className={`h-full flex flex-col transition-all ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}>
          <CardHeader className="pb-1.5 pt-2 px-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium">{title}</CardTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{funnels.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-1.5 flex-1 overflow-visible">
            <div className="space-y-1">
              {funnels.length === 0 ? (
                <div className={`text-center text-[10px] text-muted-foreground py-4 ${isDragOver ? 'border-2 border-dashed border-blue-400 rounded' : ''}`}>
                  {isDragOver ? 'Solte aqui' : 'Nenhum funil'}
                </div>
              ) : (
                funnels.map((funnel) => {
                  // Key composta para forçar re-render quando mudar de coluna
                  // Usar funnel_status como parte da key para garantir re-render imediato
                  const orderStatus = funnel.order?.status;
                  const messagesSent = funnel.messages?.filter(m => m.status === 'sent').length || 0;
                  const isExited = funnel.funnel_status === 'exited' || (messagesSent >= 4 && orderStatus === 'pending');
                  const isCompleted = orderStatus === 'paid';
                  const columnKey = isCompleted ? 'completed' : isExited ? 'exited' : 'pending';
                  return (
                    <FunnelCard 
                      key={`${funnel.id}-${status}-${funnel.funnel_status}-${columnKey}`} 
                      funnel={funnel} 
                    />
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const FunnelDetailModal = () => {
    if (!selectedFunnel) return null;

    const orderStatus = selectedFunnel.order?.status;
    const messagesSent = selectedFunnel.messages?.filter(m => m.status === 'sent').length || 0;
    const isExited = selectedFunnel.funnel_status === 'exited' || (messagesSent >= 3 && orderStatus === 'pending');
    const isCompleted = orderStatus === 'paid';
    const displayStatus = isCompleted ? 'Completo' : isExited ? 'Saiu' : 'Pendente';
    const statusColor = isCompleted ? 'bg-green-600' : isExited ? 'bg-orange-600' : 'bg-blue-600';
    const sentMessages = selectedFunnel.messages?.filter(m => m.status === 'sent') || [];
    const failedMessages = selectedFunnel.messages?.filter(m => m.status === 'failed') || [];
    const pendingMessages = selectedFunnel.messages?.filter(m => m.status === 'pending') || [];

    return (
      <Dialog open={!!selectedFunnel} onOpenChange={() => setSelectedFunnel(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Detalhes do Funil
            </DialogTitle>
            <DialogDescription>
              Funil ID: {selectedFunnel.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="messages">Mensagens ({selectedFunnel.messages_count || 0})</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatWhatsapp(selectedFunnel.customer_whatsapp)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedFunnel.customer_email}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge className={statusColor}>
                      {displayStatus}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Passo: {selectedFunnel.current_step}/4
                      <br />
                      Mensagens enviadas: {messagesSent}
                    </div>
                    {selectedFunnel.ab_variant && (
                      <Badge variant="outline">A/B: {selectedFunnel.ab_variant.toUpperCase()}</Badge>
                    )}
                    {isExited && (
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full mt-2"
                        onClick={async () => {
                          if (!confirm('Reativar este funil para enviar novas mensagens?')) return;
                          try {
                            const { data, error } = await supabase.rpc('move_funnel_to_pending', {
                              p_funnel_id: selectedFunnel.id
                            });
                            if (error) {
                              console.error('❌ [AdminWhatsappFunnel] Erro ao reativar funil no modal:', error);
                              throw error;
                            }
                            console.log('✅ [AdminWhatsappFunnel] Funil reativado no modal:', { funnel_id: data });
                            toast.success('Funil reativado!');
                            loadFunnels();
                            setSelectedFunnel(null);
                          } catch (error: any) {
                            console.error('❌ [AdminWhatsappFunnel] Erro completo ao reativar no modal:', error);
                            toast.error(`Erro ao reativar: ${error.message || 'Erro desconhecido'}`);
                          }
                        }}
                      >
                        Reativar Funil
                      </Button>
                    )}
                    
                    {/* Botão de excluir no modal */}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full mt-2"
                      disabled={deletingFunnelId === selectedFunnel.id}
                      onClick={async () => {
                        if (!confirm(`Tem certeza que deseja excluir o funil do cliente ${selectedFunnel.customer_email}?\n\nEsta ação irá:\n- Remover o funil do sistema\n- Remover todas as mensagens relacionadas\n\nEsta ação não pode ser desfeita.`)) return;
                        
                        setDeletingFunnelId(selectedFunnel.id);
                        
                        try {
                          console.log(`🗑️ [AdminWhatsappFunnel] Iniciando exclusão do funil ${selectedFunnel.id} (modal)...`);
                          
                          // Primeiro, tentar excluir mensagens relacionadas
                          const { error: messagesError } = await supabase
                            .from('whatsapp_messages')
                            .delete()
                            .eq('funnel_id', selectedFunnel.id);
                          
                          if (messagesError) {
                            console.warn(`⚠️ [AdminWhatsappFunnel] Erro ao excluir mensagens (pode ser CASCADE):`, messagesError);
                          } else {
                            console.log(`✅ [AdminWhatsappFunnel] Mensagens relacionadas excluídas`);
                          }
                          
                          // Agora excluir o funil
                          // Excluir o funil de qualquer tabela
                          const deleteResults = await Promise.allSettled([
                            supabase.from('whatsapp_funnel_pending').delete().eq('id', selectedFunnel.id).select(),
                            supabase.from('whatsapp_funnel_completed').delete().eq('id', selectedFunnel.id).select(),
                            supabase.from('whatsapp_funnel_exited').delete().eq('id', selectedFunnel.id).select(),
                          ]);
                          
                          console.log(`🔍 [AdminWhatsappFunnel] Resultados da exclusão (modal):`, deleteResults.map((r, i) => ({
                            table: ['pending', 'completed', 'exited'][i],
                            status: r.status,
                            hasError: r.status === 'fulfilled' && r.value?.error,
                            hasData: r.status === 'fulfilled' && r.value?.data?.length > 0,
                          })));
                          
                          // Verificar se pelo menos uma exclusão foi bem-sucedida
                          const successfulDelete = deleteResults.find(r => 
                            r.status === 'fulfilled' && 
                            r.value && 
                            !r.value.error &&
                            r.value.data && 
                            r.value.data.length > 0
                          );
                          
                          // Verificar se há erros críticos
                          const criticalErrors = deleteResults.filter(r => 
                            r.status === 'fulfilled' && 
                            r.value?.error &&
                            r.value.error.code !== 'PGRST116'
                          );
                          
                          if (criticalErrors.length > 0 && !successfulDelete) {
                            const firstError = criticalErrors[0];
                            if (firstError.status === 'fulfilled' && firstError.value?.error) {
                              const firstCriticalError = firstError.value.error;
                              console.error(`❌ [AdminWhatsappFunnel] Erro crítico ao excluir funil (modal):`, firstCriticalError);
                              throw firstCriticalError;
                            }
                          }
                          
                          if (!successfulDelete && criticalErrors.length === 0) {
                            console.warn(`⚠️ [AdminWhatsappFunnel] Funil ${selectedFunnel.id} não encontrado (pode já ter sido excluído)`);
                          }
                          
                          console.log(`✅ [AdminWhatsappFunnel] Funil ${selectedFunnel.id} excluído com sucesso (modal)`);
                          
                          // Remover da lista imediatamente (otimistic update)
                          // Não recarregar aqui - deixar o auto-refresh (30s) sincronizar
                          setFunnels(prev => {
                            const filtered = prev.filter(f => f.id !== selectedFunnel.id);
                            console.log(`🔄 [AdminWhatsappFunnel] Funil removido da lista (modal). Restam ${filtered.length} funis.`);
                            return filtered;
                          });
                          
                          toast.success('Funil excluído com sucesso');
                          setSelectedFunnel(null);
                        } catch (error: any) {
                          console.error('❌ [AdminWhatsappFunnel] Erro completo ao excluir funil:', {
                            funnel_id: selectedFunnel.id,
                            error: error.message,
                            code: error.code,
                            details: error.details,
                            hint: error.hint,
                          });
                          toast.error(`Erro ao excluir funil: ${error.message || 'Erro desconhecido'}`);
                        } finally {
                          setDeletingFunnelId(null);
                        }
                      }}
                    >
                      {deletingFunnelId === selectedFunnel.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Funil
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {selectedFunnel.order && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <strong>ID:</strong> {selectedFunnel.order.id}
                    </div>
                    <div className="text-sm">
                      <strong>Status:</strong> {selectedFunnel.order.status}
                    </div>
                    <div className="text-sm">
                      <strong>Valor:</strong> {formatCurrency(selectedFunnel.order.amount_cents)}
                    </div>
                    {selectedFunnel.order.plan && (
                      <div className="text-sm">
                        <strong>Plano:</strong> {selectedFunnel.order.plan}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{sentMessages.length}</div>
                      <div className="text-xs text-muted-foreground">Enviadas</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{failedMessages.length}</div>
                      <div className="text-xs text-muted-foreground">Falhadas</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{pendingMessages.length}</div>
                      <div className="text-xs text-muted-foreground">Pendentes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mensagens do Funil</CardTitle>
                  <CardDescription className="text-xs">
                    Detalhes completos de todas as mensagens enviadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedFunnel.messages && selectedFunnel.messages.length > 0 ? (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3 pr-4">
                        {selectedFunnel.messages
                          .sort((a, b) => {
                            // Ordenar por data de envio/criação (mais recente primeiro)
                            const dateA = a.sent_at || a.created_at;
                            const dateB = b.sent_at || b.created_at;
                            return new Date(dateB).getTime() - new Date(dateA).getTime();
                          })
                          .map((msg) => (
                          <Card key={msg.id} className={`border-l-4 ${
                            msg.status === 'sent' ? 'border-l-green-500' : 
                            msg.status === 'failed' ? 'border-l-red-500' : 
                            msg.status === 'pending' ? 'border-l-yellow-500' : 
                            'border-l-gray-500'
                          }`}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={STATUS_COLORS[msg.status] || STATUS_COLORS.active}>
                                      {msg.status === 'sent' ? '✅ Enviado' : msg.status === 'failed' ? '❌ Erro' : msg.status === 'pending' ? '⏳ Pendente' : '🚫 Cancelado'}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {MESSAGE_TYPE_LABELS[msg.message_type] || msg.message_type}
                                    </Badge>
                                  </div>
                                  
                                  {/* Conteúdo da mensagem */}
                                  {msg.message_text && (
                                    <div className="mb-2 p-2 bg-muted rounded text-xs">
                                      <div className="font-medium mb-1 text-muted-foreground">Conteúdo enviado:</div>
                                      <div className="whitespace-pre-wrap break-words">{msg.message_text}</div>
                                    </div>
                                  )}
                                  
                                  {/* Informações de data/hora */}
                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    {msg.sent_at ? (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span><strong>Enviado em:</strong> {formatDate(msg.sent_at)}</span>
                                      </div>
                                    ) : msg.status === 'pending' ? (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span><strong>Status:</strong> Aguardando envio</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span><strong>Criado em:</strong> {formatDate(msg.created_at)}</span>
                                      </div>
                                    )}
                                    
                                    {msg.created_at && msg.sent_at && msg.sent_at !== msg.created_at && (
                                      <div className="text-[10px] text-muted-foreground/70">
                                        Criado: {formatDate(msg.created_at)}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Mensagem de erro se houver */}
                                  {msg.status === 'failed' && msg.error_message && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                      <div className="flex items-start gap-1">
                                        <AlertTriangle className="h-3 w-3 text-red-600 shrink-0 mt-0.5" />
                                        <div>
                                          <div className="font-medium text-red-700 mb-1">Erro ao enviar:</div>
                                          <div className="text-red-600 whitespace-pre-wrap break-words">{msg.error_message}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Dados de resposta se houver */}
                                  {msg.response_data && typeof msg.response_data === 'object' && Object.keys(msg.response_data).length > 0 && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Ver detalhes técnicos
                                      </summary>
                                      <div className="mt-1 p-2 bg-muted rounded text-[10px] font-mono overflow-auto max-h-32">
                                        <pre>{JSON.stringify(msg.response_data, null, 2)}</pre>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quiz" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detalhes do Quiz</CardTitle>
                  <CardDescription className="text-xs">
                    Visualize e edite os detalhes do questionário associado a este pedido
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedFunnel.quiz ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Para quem é a música?</label>
                        <div className="p-3 bg-muted rounded text-sm">
                          {selectedFunnel.quiz.about_who || 'Não informado'}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const quizId = selectedFunnel.quiz_id || selectedFunnel.order?.quiz_id;
                            const orderId = selectedFunnel.order_id;
                            if (quizId && orderId) {
                              // Buscar token do checkout link
                              supabase
                                .from('checkout_links')
                                .select('token')
                                .eq('order_id', orderId)
                                .eq('quiz_id', quizId)
                                .gt('expires_at', new Date().toISOString())
                                .is('used_at', null)
                                .single()
                                .then(({ data: link }) => {
                                  if (link?.token) {
                                    const locale = selectedFunnel.quiz?.language || 'pt';
                                    const editUrl = `${window.location.origin}/${locale}/quiz?order_id=${orderId}&quiz_id=${quizId}&token=${link.token}&edit=true`;
                                    window.open(editUrl, '_blank');
                                    toast.success('Abrindo página de edição do quiz...');
                                  } else {
                                    toast.error('Link de edição não disponível');
                                  }
                                });
                            } else {
                              toast.error('Dados do quiz não encontrados');
                            }
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ajustar Detalhes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Quiz não encontrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Templates das Mensagens do Funil</CardTitle>
                  <CardDescription className="text-xs">
                    Visualize os templates das mensagens que serão enviadas nos intervalos determinados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4 pr-4">
                      {/* Template Mensagem 1 - Checkout Link (7 minutos) */}
                      <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Mensagem 1: Link de Checkout</CardTitle>
                            <Badge variant="outline" className="text-xs">7 minutos após pedido</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 bg-muted rounded text-xs">
                            <div className="font-medium mb-2 text-muted-foreground">Template A (Urgência):</div>
                            <div className="whitespace-pre-wrap break-words">
                              🔥 {selectedFunnel.customer_email?.split('@')[0].split('.')[0] || 'Olá'}, sua música para {selectedFunnel.quiz?.about_who || 'alguém especial'} está 99% pronta!

⏰ Últimas horas para garantir entrega em 48h
💔 Não deixe esse momento especial passar

✨ Um clique e você transforma sentimentos em música
💝 O presente mais emocionante que alguém especial vai receber
🎵 Uma canção que vai tocar o coração para sempre

🚀 Finalize AGORA e veja a magia acontecer!
💛 Não perca essa chance única de emocionar quem você ama!
                            </div>
                          </div>
                          <div className="p-3 bg-muted rounded text-xs">
                            <div className="font-medium mb-2 text-muted-foreground">Template B (Emocional):</div>
                            <div className="whitespace-pre-wrap break-words">
                              💕 {selectedFunnel.customer_email?.split('@')[0].split('.')[0] || 'Olá'}, imagina o olhar de {selectedFunnel.quiz?.about_who || 'alguém especial'} ao ouvir uma música feita só para ele(a)...

😍 Aquele sorriso que derrete o coração
💖 O momento que vai ficar na memória para sempre
🎵 Uma canção que conta sua história de amor

✨ Sua música está a um clique de se tornar realidade
⏰ Entregamos em até 48h - perfeito para surpreender
💝 Um presente que vai tocar a alma

🌟 Vamos fazer esse sonho acontecer?
💛 Não deixe essa oportunidade única passar!
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div><strong>Botão "🚀 Finalizar Agora":</strong> Vai direto para página de pagamento da Cakto (com email e WhatsApp já preenchidos)</div>
                            <div><strong>Botão "✏️ Ajustar Detalhes":</strong> Abre página de edição do quiz</div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Template Mensagem 2 - Follow-up 1 (20 minutos) */}
                      <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Mensagem 2: Follow-up 1</CardTitle>
                            <Badge variant="outline" className="text-xs">20 minutos após pedido</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 bg-muted rounded text-xs">
                            <div className="whitespace-pre-wrap break-words">
                              🔥 {selectedFunnel.customer_email?.split('@')[0].split('.')[0] || 'Olá'}, sua música para {selectedFunnel.quiz?.about_who || 'alguém especial'} está quase pronta!

⏰ Você está a um passo de criar um momento inesquecível
💔 Não deixe essa oportunidade única passar

✨ Um clique e você transforma sentimentos em música
💝 O presente mais emocionante que alguém especial vai receber
🎵 Uma canção que vai tocar o coração para sempre

🚀 Finalize AGORA e veja a magia acontecer!
⏰ Entrega garantida em até 48h
💛 Não perca essa chance única!
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div><strong>Botão "🚀 Finalizar Agora":</strong> Vai direto para página de pagamento da Cakto</div>
                            <div><strong>Botão "✏️ Ajustar Detalhes":</strong> Abre página de edição do quiz</div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Template Mensagem 3 - Follow-up 2 (1 hora) */}
                      <Card className="border-l-4 border-l-yellow-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Mensagem 3: Follow-up 2</CardTitle>
                            <Badge variant="outline" className="text-xs">1 hora após pedido</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 bg-muted rounded text-xs">
                            <div className="whitespace-pre-wrap break-words">
                              💕 {selectedFunnel.customer_email?.split('@')[0].split('.')[0] || 'Olá'}, imagina o sorriso de {selectedFunnel.quiz?.about_who || 'alguém especial'} ao receber uma música feita especialmente para ele(a)...

😍 Aquele momento que derrete o coração
💖 Uma memória que vai durar para sempre
🎵 Uma canção que conta sua história de amor

🎉 Você não está sozinho(a)!
✨ Mais de 1000 pessoas já emocionaram quem amam
💝 E agora é sua vez de criar esse momento especial

🎁 10% OFF exclusivo para você (CANTA10)
⚡ Aproveite enquanto ainda está disponível
🚀 Finalize agora e garanta esse presente único!

💛 {selectedFunnel.quiz?.about_who || 'Alguém especial'} merece esse presente especial!
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div><strong>Botão "🚀 Finalizar Agora":</strong> Vai direto para página de pagamento da Cakto</div>
                            <div><strong>Botão "✏️ Ajustar Detalhes":</strong> Abre página de edição do quiz</div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Template Mensagem 4 - Follow-up 3 (12 horas) */}
                      <Card className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Mensagem 4: Follow-up 3 (Última Chance)</CardTitle>
                            <Badge variant="outline" className="text-xs">12 horas após pedido</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 bg-muted rounded text-xs">
                            <div className="whitespace-pre-wrap break-words">
                              🚨 {selectedFunnel.customer_email?.split('@')[0].split('.')[0] || 'Olá'}, esta é sua ÚLTIMA CHANCE! ⏰

💔 Sua música personalizada para {selectedFunnel.quiz?.about_who || 'alguém especial'} está prestes a expirar
🔥 O desconto de 10% OFF (CANTA10) também vai acabar em breve

😢 Não deixe esse momento especial se perder
💝 {selectedFunnel.quiz?.about_who || 'Alguém especial'} merece esse presente único e emocionante
🎵 Uma canção que vai tocar o coração para sempre

⚡ Esta é realmente sua última oportunidade
✨ Um clique e você transforma sentimentos em música
🚀 Finalize AGORA antes que seja tarde demais!

💛 Não perca essa chance única de emocionar quem você ama!
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div><strong>Botão "🚀 Finalizar Agora":</strong> Vai direto para página de pagamento da Cakto</div>
                            <div><strong>Botão "✏️ Ajustar Detalhes":</strong> Abre página de edição do quiz</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {selectedFunnel.messages && selectedFunnel.messages.length > 0 ? (
                    selectedFunnel.messages.map((msg, index) => (
                      <div key={msg.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            msg.status === 'sent' ? 'bg-green-500' : 
                            msg.status === 'failed' ? 'bg-red-500' : 
                            'bg-yellow-500'
                          }`} />
                          {index < selectedFunnel.messages!.length - 1 && (
                            <div className="w-0.5 h-full bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium text-sm">
                              {MESSAGE_TYPE_LABELS[msg.message_type] || msg.message_type}
                            </div>
                            <Badge 
                              variant={msg.status === 'sent' ? 'default' : msg.status === 'failed' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {msg.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(msg.sent_at || msg.created_at)}
                          </div>
                          {msg.error_message && (
                            <div className="text-xs text-red-600 mt-1">
                              Erro: {msg.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma mensagem na timeline
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {selectedFunnel.messages && selectedFunnel.messages.length > 0 ? (
                    selectedFunnel.messages.map((msg) => (
                      <Card key={msg.id}>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {MESSAGE_TYPE_LABELS[msg.message_type] || msg.message_type}
                              </span>
                              <Badge variant={msg.status === 'sent' ? 'default' : 'destructive'}>
                                {msg.status}
                              </Badge>
                            </div>
                            {msg.response_data && (
                              <div className="text-xs bg-muted p-2 rounded font-mono overflow-auto">
                                <pre>{JSON.stringify(msg.response_data, null, 2)}</pre>
                              </div>
                            )}
                            {msg.error_message && (
                              <div className="text-xs text-red-600">
                                <strong>Erro:</strong> {msg.error_message}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Criada: {formatDate(msg.created_at)} | 
                              {msg.sent_at && ` Enviada: ${formatDate(msg.sent_at)}`}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhum log disponível
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  };

  const MessageDetailModal = () => {
    if (!selectedMessage) return null;

    return (
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Detalhes da Mensagem
            </DialogTitle>
            <DialogDescription>
              {MESSAGE_TYPE_LABELS[selectedMessage.message_type] || selectedMessage.message_type}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">Status</div>
                <Badge variant={selectedMessage.status === 'sent' ? 'default' : 'destructive'}>
                  {selectedMessage.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Tipo</div>
                <div className="text-sm">{MESSAGE_TYPE_LABELS[selectedMessage.message_type] || selectedMessage.message_type}</div>
              </div>
            </div>

            {selectedMessage.message_text && (
              <div>
                <div className="text-sm font-medium mb-2">Texto da Mensagem</div>
                <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                  {selectedMessage.message_text}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">Criada em</div>
                <div className="text-sm text-muted-foreground">{formatDate(selectedMessage.created_at)}</div>
              </div>
              {selectedMessage.sent_at && (
                <div>
                  <div className="text-sm font-medium mb-1">Enviada em</div>
                  <div className="text-sm text-muted-foreground">{formatDate(selectedMessage.sent_at)}</div>
                </div>
              )}
            </div>

            {selectedMessage.error_message && (
              <div>
                <div className="text-sm font-medium mb-2 text-red-600">Erro</div>
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-sm text-red-600">
                  {selectedMessage.error_message}
                </div>
              </div>
            )}

            {selectedMessage.response_data && (
              <div>
                <div className="text-sm font-medium mb-2">Dados da Resposta (UAZAPI)</div>
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-60">
                  <pre>{JSON.stringify(selectedMessage.response_data, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const exportData = () => {
    const csv = [
      ['ID', 'Order ID', 'WhatsApp', 'Email', 'Status', 'Step', 'Mensagens', 'Criado em'].join(','),
      ...filteredFunnels.map(f => [
        f.id,
        f.order_id,
        f.customer_whatsapp,
        f.customer_email,
        f.funnel_status,
        f.current_step,
        f.messages_count || 0,
        formatDate(f.created_at)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-funnel-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Dados exportados com sucesso!');
  };

  // Se houver erro crítico e não estiver carregando, mostrar mensagem de erro
  if (error && !loading) {
    return (
      <div className="container mx-auto p-0">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao Carregar Funil WhatsApp</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Por favor, execute as migrations SQL no Supabase para criar as tabelas necessárias:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground mb-4">
              <li>20250208000000_create_separated_funnel_tables.sql</li>
              <li>20250208000001_migrate_existing_funnel_data.sql</li>
              <li>20250208000002_fix_whatsapp_messages_foreign_key.sql</li>
            </ul>
            <Button onClick={() => { setError(null); loadFunnels(); }}>
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3 max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-2 md:gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Funil WhatsApp</h1>
          <p className="text-xs md:text-base text-muted-foreground mt-0.5 md:mt-1">
            Gerenciamento completo de funis de vendas via WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          {/* REMOVIDO: Botão manual não é mais necessário - migração é automática via cron job */}
          <Button 
            onClick={async () => {
              try {
                setAuditLoading(true);
                setShowAuditPanel(true);
                toast.info('Executando auditoria completa...');
                
                const { data, error } = await supabase.rpc('audit_pending_orders_funnel');
                
                if (error) {
                  throw error;
                }
                
                if (!data || data.length === 0) {
                  toast.info('Nenhum dado retornado da auditoria');
                  setAuditData(null);
                  return;
                }
                
                // Agrupar resultados por seção
                const grouped = (data as any[]).reduce((acc: any, row: any) => {
                  const section = row.section || 'Outros';
                  if (!acc[section]) {
                    acc[section] = [];
                  }
                  acc[section].push({
                    metric: row.metric_name,
                    value: row.metric_value,
                    details: row.details
                  });
                  return acc;
                }, {});
                
                setAuditData(grouped);
                
                // Mostrar resultados no console também
                console.group('📊 AUDITORIA COMPLETA: Pedidos Pending e Funis');
                Object.entries(grouped).forEach(([section, items]: [string, any]) => {
                  console.group(`📋 ${section}`);
                  items.forEach((item: any) => {
                    console.log(`${item.metric}: ${item.value}`, item.details || '');
                  });
                  console.groupEnd();
                });
                console.groupEnd();
                
                toast.success('Auditoria concluída!');
              } catch (error: any) {
                console.error('❌ Erro ao executar auditoria:', error);
                toast.error(`Erro na auditoria: ${error.message || 'Erro desconhecido'}`);
                setAuditData(null);
              } finally {
                setAuditLoading(false);
              }
            }}
            disabled={auditLoading || processingPending}
            variant="outline"
            size="sm"
            title="Executa auditoria completa para investigar por que pedidos pending não aparecem"
          >
            <AlertCircle className={`h-4 w-4 mr-2 ${auditLoading ? 'animate-spin' : ''}`} />
            Auditar
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button 
            onClick={dispatchAllPendingFunnels} 
            disabled={sendingBulk || loading} 
            variant="default" 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {sendingBulk ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {bulkProgress.total > 0 ? `Enviando ${bulkProgress.current}/${bulkProgress.total}...` : 'Enviando...'}
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Disparar Funil
              </>
            )}
          </Button>
          <Button onClick={loadFunnels} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Banner Informativo sobre Configurações */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                Configurações Atualizadas do Funil WhatsApp
              </div>
              <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <div>• <strong>Botão "🚀 Finalizar Agora":</strong> Agora vai direto para a página de pagamento da Cakto (com email e WhatsApp já preenchidos), sem passar pelo checkout interno</div>
                <div>• <strong>Mensagens do WhatsApp:</strong> O botão "Finalizar Agora" nas mensagens também vai direto para a Cakto</div>
                <div>• <strong>Intervalo da primeira mensagem:</strong> Enviada após 7 minutos (antes era 5 minutos)</div>
                <div>• <strong>Atualização manual:</strong> A página não atualiza automaticamente - use o botão "Atualizar" quando necessário</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Painel de Auditoria */}
      {showAuditPanel && (
        <Card className="border-2 border-orange-200 dark:border-orange-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Auditoria: Pedidos Pending e Funis
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAuditPanel(false);
                  setAuditData(null);
                }}
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Executando auditoria...</span>
              </div>
            ) : auditData ? (
              <div className="space-y-6">
                {/* Estatísticas Principais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {auditData['1. Pedidos Pending']?.map((item: any, idx: number) => (
                    <Card key={idx}>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">{item.metric}</div>
                        <div className="text-2xl font-bold">{item.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Análise */}
                {auditData['3. Análise'] && (
                  <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                    <CardHeader>
                      <CardTitle className="text-lg">Análise</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {auditData['3. Análise'].map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-sm">{item.metric}:</span>
                            <Badge variant={item.metric.includes('SEM funil') ? 'destructive' : 'default'} className="text-sm">
                              {item.value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Estatísticas de Funis */}
                {auditData['2. Funis'] && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Estatísticas de Funis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {auditData['2. Funis'].map((item: any, idx: number) => (
                          <div key={idx} className="text-center">
                            <div className="text-sm text-muted-foreground mb-1">{item.metric}</div>
                            <div className="text-xl font-bold">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Lista de Pedidos Sem Funil */}
                {auditData['4. Pedidos Sem Funil'] && auditData['4. Pedidos Sem Funil'].length > 0 && (
                  <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Pedidos Sem Funil ({auditData['4. Pedidos Sem Funil'].length})
                        </CardTitle>
                        <Button
                          onClick={async () => {
                            if (!confirm(`Criar funis para ${auditData['4. Pedidos Sem Funil'].length} pedidos sem funil?`)) {
                              return;
                            }
                            try {
                              setProcessingPending(true);
                              toast.info(`Criando funis para ${auditData['4. Pedidos Sem Funil'].length} pedidos...`);
                              
                              const orderIds = auditData['4. Pedidos Sem Funil'].map((item: any) => item.value);
                              let created = 0;
                              let errors = 0;
                              
                              for (const orderId of orderIds) {
                                try {
                                  const { data: funnelId, error: createError } = await supabase.rpc('create_funnel_for_order', {
                                    p_order_id: orderId
                                  });
                                  
                                  if (createError || !funnelId) {
                                    console.error(`❌ Erro ao criar funil para pedido ${orderId}:`, createError);
                                    errors++;
                                  } else {
                                    created++;
                                  }
                                } catch (err: any) {
                                  console.error(`❌ Erro ao processar pedido ${orderId}:`, err);
                                  errors++;
                                }
                              }
                              
                              if (created > 0) {
                                toast.success(`${created} funil(is) criado(s) com sucesso!`);
                                await loadFunnels();
                                await checkPendingOrdersCount();
                                
                                // Recarregar auditoria
                                const { data: newAuditData } = await supabase.rpc('audit_pending_orders_funnel');
                                if (newAuditData) {
                                  const grouped = (newAuditData as any[]).reduce((acc: any, row: any) => {
                                    const section = row.section || 'Outros';
                                    if (!acc[section]) acc[section] = [];
                                    acc[section].push({
                                      metric: row.metric_name,
                                      value: row.metric_value,
                                      details: row.details
                                    });
                                    return acc;
                                  }, {});
                                  setAuditData(grouped);
                                }
                              }
                              
                              if (errors > 0) {
                                toast.warning(`${errors} erro(s) ao criar alguns funis. Verifique o console.`);
                              }
                            } catch (error: any) {
                              console.error('❌ Erro ao criar funis:', error);
                              toast.error(`Erro: ${error.message || 'Erro desconhecido'}`);
                            } finally {
                              setProcessingPending(false);
                            }
                          }}
                          disabled={processingPending}
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className={`h-4 w-4 mr-2 ${processingPending ? 'animate-spin' : ''}`} />
                          Criar Funis para Todos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2">
                          {auditData['4. Pedidos Sem Funil'].slice(0, 50).map((item: any, idx: number) => {
                            const details = item.details || {};
                            return (
                              <div key={idx} className="p-2 border rounded text-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono text-xs">{item.value.slice(0, 8)}...</span>
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(details.tempo_desde_pending_minutos || 0)} min
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  📱 {details.customer_whatsapp || 'N/A'} | 📧 {details.customer_email || 'N/A'}
                                </div>
                              </div>
                            );
                          })}
                          {auditData['4. Pedidos Sem Funil'].length > 50 && (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              ... e mais {auditData['4. Pedidos Sem Funil'].length - 50} pedidos
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* Inconsistências */}
                {auditData['6. Inconsistências'] && auditData['6. Inconsistências'].length > 0 && (
                  <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                    <CardHeader>
                      <CardTitle className="text-lg">⚠️ Inconsistências Encontradas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {auditData['6. Inconsistências'].length} pedido(s) com funis em múltiplas tabelas. Verifique o console para detalhes.
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum dado de auditoria disponível
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Banner de Funcionamento Automático */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Sistema Automático Ativo
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                O funil de WhatsApp está funcionando automaticamente:
              </p>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
                <li>Pedidos entram no funil <strong>automaticamente</strong> quando são criados com status "pending" (via trigger)</li>
                <li>Pedidos pending sem funil são migrados <strong>automaticamente</strong> a cada 5 minutos (via cron job)</li>
                <li>Mensagens começam a ser disparadas após <strong>7 minutos</strong> desde que o pedido entrou em pending</li>
                <li>Pedidos pagos são movidos para "completed" <strong>automaticamente</strong> (verificação a cada 1 minuto)</li>
                <li><strong>Botões das mensagens:</strong> "Finalizar Agora" vai direto para Cakto (pagamento), "Ajustar Detalhes" abre edição do quiz</li>
                <li>Cron jobs: <strong>auto_migrate_all_pending_orders</strong> (5 min), <strong>check-payments</strong> (1 min), <strong>process-funnel</strong> (5 min)</li>
              </ul>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Tudo funciona automaticamente. Use o painel de auditoria para verificar o status dos pedidos e funis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="text-sm text-muted-foreground">Total de Funis</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            </div>
            <div className="text-sm text-muted-foreground">Ativos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
            </div>
            <div className="text-sm text-muted-foreground">Mensagens Enviadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </div>
            <div className="text-sm text-muted-foreground">Mensagens Falhadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</div>
            </div>
            <div className="text-sm text-muted-foreground">Taxa de Sucesso</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por email, WhatsApp ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-14"
                style={{ paddingLeft: '3.5rem' }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="completed">Completo</option>
              <option value="exited">Saiu</option>
            </select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Tabela
              </Button>
              <Button
                variant={viewMode === 'stats' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('stats')}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando funis...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && funnels.length === 0 && (
        <Card>
          <CardContent className="p-6 md:p-8 text-center">
            <MessageSquare className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-base md:text-lg font-semibold mb-2">Nenhum funil encontrado</h3>
            <p className="text-sm md:text-base text-muted-foreground">
              Quando houver pedidos não pagos há mais de 20 minutos, os funis serão criados automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {!loading && funnels.length > 0 && viewMode === 'kanban' && (
        <div 
          key={`kanban-${kanbanKey}`}
          className="flex gap-2 overflow-x-auto pb-2 items-stretch" 
          style={{ maxHeight: 'calc(100vh - 360px)' }}
        >
          <KanbanColumn title="Pendente" funnels={kanbanColumns.pending} status="pending" />
          <KanbanColumn title="Completo" funnels={kanbanColumns.completed} status="completed" />
          <KanbanColumn title="Saiu" funnels={kanbanColumns.exited} status="exited" />
        </div>
      )}

      {/* Table View */}
      {!loading && funnels.length > 0 && viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <div className="h-[calc(100vh-360px)] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium">WhatsApp</th>
                    <th className="text-left p-2 text-xs font-medium">Email</th>
                    <th className="text-left p-2 text-xs font-medium">Status</th>
                    <th className="text-left p-2 text-xs font-medium">Step</th>
                    <th className="text-left p-2 text-xs font-medium">Msgs</th>
                    <th className="text-left p-2 text-xs font-medium">Criado</th>
                    <th className="text-left p-2 text-xs font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunnels.map((funnel) => {
                    const orderStatus = funnel.order?.status;
                    const messagesSent = funnel.messages?.filter(m => m.status === 'sent').length || 0;
                    const isExited = funnel.funnel_status === 'exited' || (messagesSent >= 4 && orderStatus === 'pending');
                    const isCompleted = orderStatus === 'paid';
                    const displayStatus = isCompleted ? 'Completo' : isExited ? 'Saiu' : 'Pendente';
                    const statusColor = isCompleted ? 'bg-green-600' : isExited ? 'bg-orange-600' : 'bg-blue-600';
                    
                    return (
                      <tr key={funnel.id} className="border-t hover:bg-muted/50">
                        <td className="p-2 text-xs break-all">{funnel.customer_whatsapp}</td>
                        <td className="p-2 text-xs break-all">{funnel.customer_email}</td>
                        <td className="p-2">
                          <Badge className={`${statusColor} text-xs px-1.5 py-0`}>
                            {displayStatus}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">{funnel.current_step}/4</td>
                        <td className="p-2 text-xs">{messagesSent}</td>
                        <td className="p-2 text-xs">{formatDate(funnel.created_at)}</td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedFunnel(funnel)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats View */}
      {!loading && funnels.length > 0 && viewMode === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(kanbanColumns).map(([status, funnels]) => {
                  const labels: Record<string, string> = {
                    pending: 'Pendente',
                    completed: 'Completo',
                    exited: 'Saiu'
                  };
                  const colors: Record<string, string> = {
                    pending: 'bg-blue-600',
                    completed: 'bg-green-600',
                    exited: 'bg-orange-600'
                  };
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm">{labels[status] || status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${colors[status] || 'bg-gray-600'}`}
                            style={{ width: `${(funnels.length / filteredFunnels.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{funnels.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(
                  filteredFunnels
                    .flatMap(f => f.messages || [])
                    .reduce((acc, msg) => {
                      acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm">{MESSAGE_TYPE_LABELS[type] || type}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <FunnelDetailModal />
      <MessageDetailModal />
    </div>
  );
}
