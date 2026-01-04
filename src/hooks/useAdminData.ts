import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendReleaseWebhook } from '@/utils/webhook';

/**
 * Função auxiliar para contar pedidos via paginação (suporta milhões de registros)
 * Se count exact falhar, conta manualmente via paginação
 */
async function countOrdersPaginated(filters?: {
  status?: string;
  provider?: 'stripe' | 'cakto';
  plan?: string;
}): Promise<number> {
  // Primeiro tentar count exact
  let query = supabase.from("orders").select("id", { count: 'exact', head: true });
  
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  
  if (filters?.provider === 'stripe') {
    query = query.or("payment_provider.eq.stripe,provider.eq.stripe");
  } else if (filters?.provider === 'cakto') {
    query = query.not("payment_provider", "eq", "stripe").not("provider", "eq", "stripe");
  }
  
  const { count, error } = await query;
  
  // Se count exact funcionou e retornou um valor, usar ele
  if (!error && count !== null && count > 0) {
    return count;
  }
  
  // Se count exact falhou ou retornou 0/null, contar manualmente via paginação
  
  let totalCount = 0;
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let countQuery = supabase.from("orders").select("id");
    
    if (filters?.status) {
      countQuery = countQuery.eq("status", filters.status);
    }
    
    if (filters?.plan) {
      countQuery = countQuery.eq("plan", filters.plan);
    }
    
    if (filters?.provider === 'stripe') {
      countQuery = countQuery.or("payment_provider.eq.stripe,provider.eq.stripe");
    } else if (filters?.provider === 'cakto') {
      countQuery = countQuery.not("payment_provider", "eq", "stripe").not("provider", "eq", "stripe");
    }
    
    const { data, error: dataError } = await countQuery.range(from, from + pageSize - 1);
    
    if (dataError || !data || data.length === 0) {
      hasMore = false;
    } else {
      totalCount += data.length;
      from += pageSize;
      hasMore = data.length === pageSize;
      
    }
  }
  
  return totalCount;
}

/**
 * Função auxiliar para buscar receita via paginação (suporta milhões de registros)
 */
async function fetchRevenuePaginated(filters?: {
  provider?: 'stripe' | 'cakto';
}): Promise<number> {
  let totalRevenue = 0;
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("orders")
      .select("amount_cents")
      .eq("status", "paid");
    
    if (filters?.provider === 'stripe') {
      query = query.or("payment_provider.eq.stripe,provider.eq.stripe");
    } else if (filters?.provider === 'cakto') {
      query = query.not("payment_provider", "eq", "stripe").not("provider", "eq", "stripe");
    }
    
    const { data, error } = await query.range(from, from + pageSize - 1);
    
    if (error) {
      console.error('Erro ao buscar receita via paginação:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      const pageRevenue = data.reduce((sum: number, o: any) => {
        const amount = o.amount_cents || 0;
        return sum + (typeof amount === 'number' && !isNaN(amount) ? amount : 0);
      }, 0);
      
      totalRevenue += pageRevenue;
      from += pageSize;
      hasMore = data.length === pageSize;
    }
  }
  
  return totalRevenue / 100; // Converter centavos para reais
}

async function fetchRevenueAggregate(filters?: {
  provider?: 'stripe' | 'cakto';
  plan?: string;
}): Promise<number> {
  try {
    // ✅ CORREÇÃO: Usar paginação ao invés de agregação (mais confiável para grandes volumes)
    // A sintaxe de agregação do Supabase pode não funcionar corretamente
    console.log(`🔍 [fetchRevenueAggregate] Buscando receita para ${filters?.provider || 'all'}...`);
    
    // Se não há filtro de plan, usar função de paginação otimizada
    if (!filters?.plan) {
      const revenue = await fetchRevenuePaginated({ provider: filters?.provider });
      console.log(`✅ [fetchRevenueAggregate] Receita ${filters?.provider || 'all'} (via paginação): R$ ${revenue.toFixed(2)}`);
      return revenue;
    }
    
    // Se há filtro de plan, fazer query manual com paginação
    let totalRevenue = 0;
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("orders")
        .select("amount_cents")
        .eq("status", "paid")
        .eq("plan", filters.plan!);
      
      if (filters?.provider === 'stripe') {
        query = query.or("payment_provider.eq.stripe,provider.eq.stripe");
      } else if (filters?.provider === 'cakto') {
        query = query.not("payment_provider", "eq", "stripe").not("provider", "eq", "stripe");
      }
      
      const { data, error } = await query.range(from, from + pageSize - 1);
      
      if (error) {
        console.error(`❌ [fetchRevenueAggregate] Erro ao buscar receita (${filters?.provider || 'all'}):`, error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        const pageRevenue = data.reduce((sum: number, o: any) => {
          const amount = o.amount_cents || 0;
          return sum + (typeof amount === 'number' && !isNaN(amount) ? amount : 0);
        }, 0);
        
        totalRevenue += pageRevenue;
        from += pageSize;
        hasMore = data.length === pageSize;
      }
    }
    
    const revenue = totalRevenue / 100;
    console.log(`✅ [fetchRevenueAggregate] Receita ${filters?.provider || 'all'} (com plan ${filters.plan}): R$ ${revenue.toFixed(2)}`);
    return revenue;
  } catch (error) {
    console.error(`❌ [fetchRevenueAggregate] Erro ao calcular receita (${filters?.provider || 'all'}):`, error);
    throw error;
  }
}

/**
 * Hook para carregar estatísticas do dashboard
 * Cache: 2 minutos (dados mudam frequentemente)
 */
export function useDashboardStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      // ✅ CORREÇÃO: Para mais de 1 milhão de registros, usar RPC ou contar via paginação
      // Tentar primeiro com count exact, se falhar, usar paginação
      
      let totalOrders = 0;
      let paidOrders = 0;
      let stripeOrders = 0;
      let caktoOrders = 0;
      
      try {
        // ✅ OTIMIZAÇÃO: Tentar count exact primeiro com timeout de 5 segundos
        const countPromise = Promise.all([
          supabase.from("orders").select("id", { count: 'exact', head: true }),
          supabase.from("orders").select("id", { count: 'exact', head: true }).eq("status", "paid"),
          supabase.from("orders")
            .select("id", { count: 'exact', head: true })
            .eq("status", "paid")
            .or("payment_provider.eq.stripe,provider.eq.stripe"),
          supabase.from("orders")
            .select("id", { count: 'exact', head: true })
            .eq("status", "paid")
            .not("payment_provider", "eq", "stripe")
            .not("provider", "eq", "stripe"),
        ]);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Count timeout')), 3000)
        );
        
        const [
          totalOrdersResult,
          paidOrdersResult,
          stripeOrdersResult,
          caktoOrdersResult
        ] = await Promise.race([countPromise, timeoutPromise]) as any[];
        
        totalOrders = totalOrdersResult.count ?? 0;
        paidOrders = paidOrdersResult.count ?? 0;
        stripeOrders = stripeOrdersResult.count ?? 0;
        caktoOrders = caktoOrdersResult.count ?? 0;
        
        // ✅ CORREÇÃO: Se o count retornar um valor suspeitamente baixo (< 50k), usar paginação
        // Mas apenas se realmente necessário (não bloquear carregamento)
        if (!totalOrdersResult.count || totalOrdersResult.count < 50000) {
          // ✅ OTIMIZAÇÃO: Usar paginação apenas em background, não bloquear
          // Por enquanto, usar os valores do count mesmo que baixos
          // A paginação pode ser feita em background se necessário
          console.warn('Count retornou valor baixo, mas usando mesmo assim para performance');
        }
      } catch (error) {
        // ✅ OTIMIZAÇÃO: Se timeout ou erro, usar valores do cache anterior se disponível
        const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
        if (cachedData && typeof cachedData === 'object') {
          const cached = cachedData as any;
          totalOrders = cached.totalOrders || 0;
          paidOrders = cached.paidOrders || 0;
          stripeOrders = cached.stripeOrders || 0;
          caktoOrders = cached.caktoOrders || 0;
        }
        console.warn('Timeout ou erro ao contar pedidos, usando cache anterior:', error);
      }
      
      // ✅ OTIMIZAÇÃO: Buscar receitas com timeout de 30 segundos (aumentado para suportar milhões de pedidos)
      // Se demorar muito, usar valores do cache anterior (não zerar se cache tem valores válidos)
      let stripeRevenue = 0;
      let caktoRevenue = 0;
      
      // ✅ CORREÇÃO: Buscar cache primeiro para ter valores de fallback
      const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
      const cachedRevenue = cachedData && typeof cachedData === 'object' ? {
        stripe: (cachedData as any).stripeRevenue,
        cakto: (cachedData as any).caktoRevenue
      } : null;
      
      try {
        const revenuePromise = Promise.all([
          fetchRevenueAggregate({ provider: 'stripe' }),
          fetchRevenueAggregate({ provider: 'cakto' }),
        ]);
        
        const revenueTimeout = new Promise<[number, number]>((resolve) => 
          setTimeout(() => {
            // ✅ CORREÇÃO: Se timeout, usar cache se disponível, senão tentar buscar novamente sem timeout
            if (cachedRevenue && (cachedRevenue.stripe > 0 || cachedRevenue.cakto > 0)) {
              console.warn('⚠️ [Dashboard] Timeout ao buscar receitas, usando cache:', cachedRevenue);
              resolve([cachedRevenue.stripe || 0, cachedRevenue.cakto || 0]);
            } else {
              // Se cache também está zerado, tentar buscar uma vez mais sem timeout
              console.warn('⚠️ [Dashboard] Timeout e cache zerado, tentando buscar receitas novamente...');
              Promise.all([
                fetchRevenueAggregate({ provider: 'stripe' }).catch(() => cachedRevenue?.stripe || 0),
                fetchRevenueAggregate({ provider: 'cakto' }).catch(() => cachedRevenue?.cakto || 0),
              ]).then(resolve).catch(() => resolve([0, 0]));
            }
          }, 30000) // ✅ CORREÇÃO: Timeout aumentado para 30 segundos
        );
        
        const result = await Promise.race([revenuePromise, revenueTimeout]);
        stripeRevenue = result[0];
        caktoRevenue = result[1];
        
        // ✅ CORREÇÃO: Se resultado for 0 mas cache tinha valores, usar cache
        if (stripeRevenue === 0 && caktoRevenue === 0 && cachedRevenue && (cachedRevenue.stripe > 0 || cachedRevenue.cakto > 0)) {
          console.warn('⚠️ [Dashboard] Receitas retornaram 0, usando cache:', cachedRevenue);
          stripeRevenue = cachedRevenue.stripe || 0;
          caktoRevenue = cachedRevenue.cakto || 0;
        } else if (stripeRevenue > 0 || caktoRevenue > 0) {
          console.log(`✅ [Dashboard] Receitas carregadas: Stripe=$${stripeRevenue.toFixed(2)}, Cakto=R$${caktoRevenue.toFixed(2)}`);
        }
      } catch (error) {
        // Erro - usar cache anterior se disponível
        console.error('❌ [Dashboard] Erro ao buscar receitas:', error);
        if (cachedRevenue && (cachedRevenue.stripe > 0 || cachedRevenue.cakto > 0)) {
          stripeRevenue = cachedRevenue.stripe || 0;
          caktoRevenue = cachedRevenue.cakto || 0;
          console.warn('⚠️ [Dashboard] Usando receitas do cache devido a erro:', { stripeRevenue, caktoRevenue });
        } else {
          // Se não tem cache válido, tentar buscar uma última vez
          try {
            const [stripe, cakto] = await Promise.all([
              fetchRevenueAggregate({ provider: 'stripe' }).catch(() => 0),
              fetchRevenueAggregate({ provider: 'cakto' }).catch(() => 0),
            ]);
            stripeRevenue = stripe;
            caktoRevenue = cakto;
          } catch (retryError) {
            console.error('❌ [Dashboard] Erro ao tentar buscar receitas novamente:', retryError);
            stripeRevenue = 0;
            caktoRevenue = 0;
          }
        }
      }
      
      
      const result = {
        totalOrders,
        paidOrders,
        stripeOrders,
        caktoOrders,
        stripeRevenue,
        caktoRevenue,
        totalRevenueBRL: caktoRevenue,
        totalRevenueUSD: stripeRevenue,
        totalRevenueBRLConverted: caktoRevenue + (stripeRevenue * 5.5),
      };
      
      return result;
    },
    enabled: options?.enabled ?? true,
    staleTime: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: 15 minutos (dados não mudam tão rápido)
    gcTime: 30 * 60 * 1000, // ✅ OTIMIZAÇÃO: 30 minutos (mantém cache por mais tempo)
    refetchInterval: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: Atualizar a cada 15min (reduz carga significativamente)
    placeholderData: (previousData) => previousData, // ✅ OTIMIZAÇÃO: Mostrar dados anteriores enquanto carrega
    refetchOnMount: true, // ✅ CORREÇÃO: Refetch ao montar para garantir dados atualizados
    refetchOnWindowFocus: false, // ✅ OTIMIZAÇÃO: Não refetch ao focar
  });
}

/**
 * Hook para carregar dados de vendas para gráficos
 * Cache: 3 minutos
 */
export function useSalesData(period: '7d' | '30d' | '90d' | 'month' | 'all', selectedMonth?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.salesData(period, selectedMonth),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Buscar apenas pedidos pagos do período necessário
      // Limitar a no máximo 10.000 pedidos para evitar timeout
      
      // Calcular período de datas
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7d':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          break;
        case '30d':
          startDate = new Date(2024, 10, 3); // 03/11/2024
          break;
        case '90d':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 89);
          break;
        case 'month':
          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          }
          break;
        case 'all':
          startDate = new Date(0);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 29);
      }
      
      let allOrders: any[] = [];
      let from = 0;
      const pageSize = 1000;
      const maxOrders = 200000; // Aumentado para suportar mais pedidos (200k)
      let hasMore = true;
      
      while (hasMore && allOrders.length < maxOrders) {
        const query = supabase
          .from("orders")
          .select("id, status, amount_cents, payment_provider, provider, created_at, paid_at")
          .eq("status", "paid")
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        
        const { data: pageData, error } = await query;
        
        if (error) throw error;
        
        if (pageData && pageData.length > 0) {
          allOrders = allOrders.concat(pageData);
          from += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allOrders;
    },
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

/**
 * Interface para dados agregados de vendas por dia
 */
interface SalesDataByDate {
  stripe: number;
  cakto: number;
  count: number;
  stripeCount: number;
  caktoCount: number;
}

/**
 * Interface para dados de vendas formatados para gráficos
 */
export interface SalesData {
  date: string;
  dateKey: string;
  fullDate?: string;
  stripe: number;
  cakto: number;
  total: number;
  count: number;
  stripeCount: number;
  caktoCount: number;
  totalCount: number;
}

/**
 * Interface para cache de vendas
 */
interface SalesCache {
  lastUpdate: string; // "YYYY-MM-DD"
  data: Record<string, SalesDataByDate>;
}

/**
 * Taxa de conversão USD -> BRL
 */
const USD_TO_BRL = 5.5;

/**
 * Pedidos marcados manualmente (especiais)
 */
const MANUAL_ORDERS = [
  { id: '5759ca8f-44ce-43bd-af52-85a12f715bb2', date: '2025-11-07', email: 'micheledepaulad@gmail.com' },
  { id: 'bf7ccd66-2b3d-4248-839b-362c77df009a', date: '2025-11-07', email: 'lindysouto13@gmail.com' },
  { id: 'bf84ece4-e2ac-4f37-9a41-7c2aa5644227', date: '2025-11-10', email: 'machadomaciel77@gmail.com' },
  { id: 'cc23166c-3843-4f09-9560-1311b2a77058', date: '2025-11-11', email: 'mauracriscastro@gmail.com' },
  { id: 'ec87e1bf-541d-4292-b393-9aaa8fb9eacf', date: '2025-11-11', email: 'baixinhodagalo@yahoo.com.br' },
];

/**
 * Obtém a data atual no horário de Brasília
 */
function getBrasiliaDate(): { year: number; month: number; day: number; date: Date } {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [monthStr, dayStr, yearStr] = brasiliaDateStr.split('/');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  
  const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  
  return { year, month, day, date };
}

/**
 * Cria uma data no horário de Brasília
 */
function createBrasiliaDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * Processa dados agregados de vendas e formata para gráficos
 */
function processSalesDataForCharts(
  aggregatedData: Record<string, SalesDataByDate>,
  period: '7d' | '30d' | '90d' | 'month' | 'all',
  selectedMonth?: string
): SalesData[] {
  const { year, month, day, date: todayBrasiliaUTC } = getBrasiliaDate();
  
  // Filtrar dados por período
  let filteredEntries = Object.entries(aggregatedData);
  let groupByMonth = false;
  
  if (period === '30d') {
    // Filtrar desde 03/11
    let startYear = year;
    if (month < 11 || (month === 11 && day < 3)) {
      startYear = year - 1;
    }
    const startDate = createBrasiliaDate(startYear, 11, 3);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= startDate && date <= todayBrasiliaUTC;
    });
  } else if (period === '7d') {
    const sevenDaysAgo = new Date(todayBrasiliaUTC);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= sevenDaysAgo && date <= todayBrasiliaUTC;
    });
  } else if (period === '90d') {
    const ninetyDaysAgo = new Date(todayBrasiliaUTC);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);
    
    filteredEntries = filteredEntries.filter(([dateKey]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = createBrasiliaDate(y, m, d);
      return date >= ninetyDaysAgo && date <= todayBrasiliaUTC;
    });
  } else if (period === 'month') {
    groupByMonth = true;
    if (selectedMonth) {
      const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
      filteredEntries = filteredEntries.filter(([dateKey]) => {
        const [y, m] = dateKey.split('-').map(Number);
        return y === selectedYear && m === selectedMonthNum;
      });
    } else {
      filteredEntries = filteredEntries.filter(([dateKey]) => {
        const [y, m] = dateKey.split('-').map(Number);
        return y === year && m === month;
      });
    }
  }
  
  // Converter para array formatado
  const salesArray: SalesData[] = filteredEntries
    .filter(([_, values]) => values.count > 0)
    .map(([dateKey, values]): SalesData => {
      if (groupByMonth) {
        const [y, m] = dateKey.split('-').map(Number);
        const monthName = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
        const dateDisplay = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y}`;
        
        return {
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: dateDisplay,
          stripe: values.stripe,
          cakto: values.cakto,
          total: values.stripe * USD_TO_BRL + values.cakto,
          count: values.count,
          stripeCount: values.stripeCount,
          caktoCount: values.caktoCount,
          totalCount: values.count,
        };
      } else {
        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        const dateDisplay = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
        const fullDate = dateObj.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short',
          timeZone: 'UTC'
        });
        
        return {
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: fullDate,
          stripe: values.stripe,
          cakto: values.cakto,
          total: values.stripe * USD_TO_BRL + values.cakto,
          count: values.count,
          stripeCount: values.stripeCount,
          caktoCount: values.caktoCount,
          totalCount: values.count,
        };
      }
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  
  // Preencher dias faltantes para período 30d
  if (period === '30d' && !groupByMonth) {
    let startYear = year;
    if (month < 11 || (month === 11 && day < 3)) {
      startYear = year - 1;
    }
    const startDate = createBrasiliaDate(startYear, 11, 3);
    
    const completeArray: SalesData[] = [];
    const existingDataMap = new Map(salesArray.map(d => [d.dateKey, d]));
    
    const diffTime = todayBrasiliaUTC.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    for (let i = 0; i < diffDays; i++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + i);
      
      const dateInBrasilia = date.toLocaleString('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [monthStr, dayStr, yearStr] = dateInBrasilia.split('/');
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const dayNum = parseInt(dayStr, 10);
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      if (existingDataMap.has(dateKey)) {
        completeArray.push(existingDataMap.get(dateKey)!);
      } else {
        const dateObj = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
        const dateDisplay = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
        const fullDate = dateObj.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short',
          timeZone: 'UTC'
        });
        
        completeArray.push({
          date: dateDisplay,
          dateKey: dateKey,
          fullDate: fullDate,
          stripe: 0,
          cakto: 0,
          total: 0,
          count: 0,
          stripeCount: 0,
          caktoCount: 0,
          totalCount: 0,
        });
      }
    }
    
    return completeArray.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }
  
  return salesArray;
}

/**
 * Função auxiliar para ler cache sincronamente
 */
function getCachedSalesData(): Record<string, SalesDataByDate> | null {
  if (typeof window === 'undefined') return null;
  
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  const cacheKey = 'sales_data_cache_v1';
  
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed: SalesCache = JSON.parse(cachedData);
      
      if (parsed && parsed.lastUpdate && parsed.data) {
        // Se o cache foi atualizado hoje, usar ele
        if (parsed.lastUpdate === todayKey) {
          // Limpar cache antigo (manter apenas últimos 90 dias)
          const ninetyDaysAgo = new Date(today);
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          const cleanedData: Record<string, SalesDataByDate> = {};
          Object.entries(parsed.data).forEach(([dateKey, values]) => {
            const date = new Date(dateKey);
            if (date >= ninetyDaysAgo) {
              cleanedData[dateKey] = values;
            }
          });
          
          return cleanedData;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao ler cache de vendas:', e);
  }
  
  return null;
}

/**
 * Hook otimizado para carregar dados de vendas para gráficos
 * Usa cache de dias anteriores + carrega apenas o dia atual
 * Performance: 20-50x mais rápido que carregar todos os pedidos
 */
export function useSalesDataOptimized(
  period: '7d' | '30d' | '90d' | 'month' | 'all', 
  selectedMonth?: string
) {
  // Ler cache sincronamente para usar como initialData
  const cachedData = getCachedSalesData();
  const initialData = cachedData ? processSalesDataForCharts(cachedData, period, selectedMonth) : undefined;
  
  
  return useQuery({
    queryKey: queryKeys.dashboard.salesData(`optimized_${period}`, selectedMonth),
    queryFn: async () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheKey = 'sales_data_cache_v1';
      
      // 1. Buscar dados em cache do localStorage (dias anteriores)
      let historicalData: Record<string, SalesDataByDate> = {};
      
      if (typeof window !== 'undefined') {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const parsed: SalesCache = JSON.parse(cachedData);
            
            // Validar estrutura do cache
            if (parsed && parsed.lastUpdate && parsed.data) {
              // Se o cache foi atualizado hoje, usar ele
              if (parsed.lastUpdate === todayKey) {
                historicalData = parsed.data || {};
                
                // Limpar cache antigo (manter apenas últimos 90 dias)
                const ninetyDaysAgo = new Date(today);
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                
                const cleanedData: Record<string, SalesDataByDate> = {};
                Object.entries(historicalData).forEach(([dateKey, values]) => {
                  const date = new Date(dateKey);
                  if (date >= ninetyDaysAgo) {
                    cleanedData[dateKey] = values;
                  }
                });
                
                historicalData = cleanedData;
              } else {
                // Cache desatualizado, limpar
                localStorage.removeItem(cacheKey);
              }
            }
          }
        } catch (e) {
          console.error('Erro ao ler cache de vendas:', e);
          localStorage.removeItem(cacheKey);
        }
      }
      
      // 2. Verificar se precisa buscar dados históricos
      // Para período '30d', sempre garantir que temos dados desde 03/11
      let needsHistoricalData = Object.keys(historicalData).length === 0;
      
      if (period === '30d' && Object.keys(historicalData).length > 0) {
        // Verificar se o cache tem dados desde 03/11
        const { year, month, day } = getBrasiliaDate();
        let startYear = year;
        if (month < 11 || (month === 11 && day < 3)) {
          startYear = year - 1;
        }
        const startDate = createBrasiliaDate(startYear, 11, 3);
        const startDateKey = `${startYear}-11-03`;
        
        // Verificar se há dados desde 03/11 no cache
        const hasDataSinceStart = Object.keys(historicalData).some(dateKey => {
          const [y, m, d] = dateKey.split('-').map(Number);
          const date = createBrasiliaDate(y, m, d);
          return date >= startDate;
        });
        
        if (!hasDataSinceStart) {
          needsHistoricalData = true;
        }
      }
      
      if (needsHistoricalData) {
        // Buscar dados históricos do período
        const { year, month, day, date: todayBrasiliaUTC } = getBrasiliaDate();
        let startDateUTC: Date;
        let endDateUTC: Date;
        
        switch (period) {
          case '7d': {
            startDateUTC = new Date(todayBrasiliaUTC);
            startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 6);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case '30d': {
            let startYear = year;
            if (month < 11 || (month === 11 && day < 3)) {
              startYear = year - 1;
            }
            startDateUTC = createBrasiliaDate(startYear, 11, 3);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case '90d': {
            startDateUTC = new Date(todayBrasiliaUTC);
            startDateUTC.setUTCDate(startDateUTC.getUTCDate() - 89);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
          }
          case 'month':
            if (selectedMonth) {
              const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
              startDateUTC = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, 1, 3, 0, 0, 0));
              const lastDay = new Date(selectedYear, selectedMonthNum, 0).getDate();
              endDateUTC = new Date(Date.UTC(selectedYear, selectedMonthNum - 1, lastDay, 3, 0, 0, 0));
              endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
              endDateUTC.setUTCHours(2, 59, 59, 999);
            } else {
              startDateUTC = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
              const lastDay = new Date(year, month, 0).getDate();
              endDateUTC = new Date(Date.UTC(year, month - 1, lastDay, 3, 0, 0, 0));
              endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
              endDateUTC.setUTCHours(2, 59, 59, 999);
            }
            break;
          case 'all':
            startDateUTC = new Date(0);
            endDateUTC = new Date(todayBrasiliaUTC);
            endDateUTC.setUTCDate(endDateUTC.getUTCDate() + 1);
            endDateUTC.setUTCHours(2, 59, 59, 999);
            break;
        }
        
        // Buscar pedidos históricos do período (paginação para não sobrecarregar)
        let allHistoricalOrders: any[] = [];
        let from = 0;
        const pageSize = 1000;
        const maxOrders = 200000; // Limite para primeira carga
        let hasMore = true;
        
        while (hasMore && allHistoricalOrders.length < maxOrders) {
          const { data: pageData, error: pageError } = await supabase
            .from("orders")
            .select("id, status, amount_cents, payment_provider, provider, created_at")
            .eq("status", "paid")
            .gte("created_at", startDateUTC.toISOString())
            .lte("created_at", endDateUTC.toISOString())
            .order("created_at", { ascending: true })
            .range(from, from + pageSize - 1);
          
          if (pageError) {
            console.error('Erro ao buscar pedidos históricos:', pageError);
            break;
          }
          
          if (pageData && pageData.length > 0) {
            allHistoricalOrders = allHistoricalOrders.concat(pageData);
            from += pageSize;
            hasMore = pageData.length === pageSize;
          } else {
            hasMore = false;
          }
        }
        
        
        // Processar pedidos históricos e mesclar com cache existente
        const fetchedHistoricalData: Record<string, SalesDataByDate> = {};
        const manualOrderIds = new Set(MANUAL_ORDERS.map(o => o.id));
        
        allHistoricalOrders.forEach(order => {
          if (manualOrderIds.has(order.id)) return;
          
          const createdDate = new Date(order.created_at!);
          const dateStr = createdDate.toLocaleString('en-US', { 
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const [monthStr, dayStr, yearStr] = dateStr.split('/');
          const dateKey = `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
          
          if (!fetchedHistoricalData[dateKey]) {
            fetchedHistoricalData[dateKey] = { stripe: 0, cakto: 0, count: 0, stripeCount: 0, caktoCount: 0 };
          }
          
          const isStripe = order.payment_provider === 'stripe' || order.provider === 'stripe';
          const amount = (order.amount_cents || 0) / 100;
          
          if (isNaN(amount) || amount <= 0) return;
          
          if (isStripe) {
            fetchedHistoricalData[dateKey].stripe += amount;
            fetchedHistoricalData[dateKey].stripeCount += 1;
          } else {
            fetchedHistoricalData[dateKey].cakto += amount;
            fetchedHistoricalData[dateKey].caktoCount += 1;
          }
          fetchedHistoricalData[dateKey].count += 1;
        });
        
        // Mesclar dados buscados com cache existente (cache tem prioridade para evitar duplicação)
        Object.entries(fetchedHistoricalData).forEach(([dateKey, values]) => {
          if (!historicalData[dateKey]) {
            // Se não existe no cache, adicionar
            historicalData[dateKey] = values;
          } else {
            // Se existe no cache, somar os valores (pode haver pedidos novos)
            historicalData[dateKey].stripe += values.stripe;
            historicalData[dateKey].cakto += values.cakto;
            historicalData[dateKey].count += values.count;
            historicalData[dateKey].stripeCount += values.stripeCount;
            historicalData[dateKey].caktoCount += values.caktoCount;
          }
        });
        
        // Processar pedidos manuais do período histórico
        const manualOrdersInPeriod = MANUAL_ORDERS.filter(o => {
          const orderDate = new Date(o.date);
          return orderDate >= startDateUTC && orderDate <= endDateUTC;
        });
        
        if (manualOrdersInPeriod.length > 0) {
          const manualOrderIdsInPeriod = new Set(manualOrdersInPeriod.map(o => o.id));
          const { data: manualOrdersData } = await supabase
            .from("orders")
            .select("id, amount_cents, created_at")
            .in("id", Array.from(manualOrderIdsInPeriod))
            .eq("status", "paid");
          
          if (manualOrdersData) {
            manualOrdersData.forEach(order => {
              // Usar a data do MANUAL_ORDERS ao invés de created_at para garantir data correta
              const manualOrder = manualOrdersInPeriod.find(mo => mo.id === order.id);
              if (!manualOrder) return;
              
              const dateKey = manualOrder.date; // Já está no formato YYYY-MM-DD
              
              if (!historicalData[dateKey]) {
                historicalData[dateKey] = { stripe: 0, cakto: 0, count: 0, stripeCount: 0, caktoCount: 0 };
              }
              
              const amount = (order.amount_cents || 0) / 100;
              if (!isNaN(amount) && amount > 0) {
                historicalData[dateKey].cakto += amount;
                historicalData[dateKey].caktoCount += 1;
                historicalData[dateKey].count += 1;
              }
            });
          }
        }
        
      }
      
      // 3. Buscar APENAS pedidos do dia atual (muito mais rápido!)
      const { year, month, day } = getBrasiliaDate();
      const todayStart = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)); // 00:00:00 BRT
      const todayEnd = new Date(Date.UTC(year, month - 1, day, 26, 59, 59, 999)); // 23:59:59 BRT (26h UTC = 23:59 BRT)
      
      const todayData: Record<string, SalesDataByDate> = {};
      
      try {
        // Buscar pedidos do dia atual
        const { data: todayOrders, error } = await supabase
          .from("orders")
          .select("id, status, amount_cents, payment_provider, provider, created_at")
          .eq("status", "paid")
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());
        
        if (error) {
          console.error('Erro ao buscar pedidos do dia atual:', error);
          // Se falhar, usar apenas cache
          if (Object.keys(historicalData).length === 0) {
            throw error;
          }
        } else if (todayOrders && todayOrders.length > 0) {
          // Processar pedidos do dia atual
          const todayKeyFormatted = todayKey;
          todayData[todayKeyFormatted] = {
            stripe: 0,
            cakto: 0,
            count: 0,
            stripeCount: 0,
            caktoCount: 0,
          };
          
          const manualOrderIds = new Set(MANUAL_ORDERS.map(o => o.id));
          
          todayOrders.forEach(order => {
            // Excluir pedidos manuais (serão processados separadamente se necessário)
            if (manualOrderIds.has(order.id)) return;
            
            const isStripe = order.payment_provider === 'stripe' || order.provider === 'stripe';
            const amount = (order.amount_cents || 0) / 100;
            
            if (isNaN(amount) || amount <= 0) return;
            
            if (isStripe) {
              todayData[todayKeyFormatted].stripe += amount;
              todayData[todayKeyFormatted].stripeCount += 1;
            } else {
              todayData[todayKeyFormatted].cakto += amount;
              todayData[todayKeyFormatted].caktoCount += 1;
            }
            todayData[todayKeyFormatted].count += 1;
          });
          
          // Processar pedidos manuais do dia atual se houver
          const manualOrdersToday = MANUAL_ORDERS.filter(o => o.date === todayKey);
          if (manualOrdersToday.length > 0) {
            const manualOrderIdsToday = new Set(manualOrdersToday.map(o => o.id));
            const { data: manualOrdersData } = await supabase
              .from("orders")
              .select("id, amount_cents")
              .in("id", Array.from(manualOrderIdsToday))
              .eq("status", "paid");
            
            if (manualOrdersData) {
              manualOrdersData.forEach(order => {
                const amount = (order.amount_cents || 0) / 100;
                if (!isNaN(amount) && amount > 0) {
                  todayData[todayKeyFormatted].cakto += amount;
                  todayData[todayKeyFormatted].caktoCount += 1;
                  todayData[todayKeyFormatted].count += 1;
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar pedidos do dia atual:', error);
        // Se falhar, continuar apenas com cache
      }
      
      // 4. Combinar dados históricos (cache) + dados do dia atual
      const combinedData = { ...historicalData, ...todayData };
      
      // 5. Atualizar cache (salvar TODOS os dados para próxima execução)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            lastUpdate: todayKey,
            data: combinedData,
          }));
        } catch (e) {
          console.error('Erro ao salvar cache:', e);
          // Se localStorage estiver cheio, limpar cache antigo
          try {
            const ninetyDaysAgo = new Date(today);
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 30); // Manter apenas 30 dias
            
            const cleanedData: Record<string, SalesDataByDate> = {};
            Object.entries(combinedData).forEach(([dateKey, values]) => {
              const date = new Date(dateKey);
              if (date >= ninetyDaysAgo) {
                cleanedData[dateKey] = values;
              }
            });
            
            localStorage.setItem(cacheKey, JSON.stringify({
              lastUpdate: todayKey,
              data: cleanedData,
            }));
          } catch (e2) {
            console.error('Erro ao limpar e salvar cache:', e2);
          }
        }
      }
      
      // 6. Processar e formatar dados para gráficos
      const result = processSalesDataForCharts(combinedData, period, selectedMonth);
      
      
      return result;
    },
    initialData: initialData, // ✅ Mostrar dados do cache imediatamente
    placeholderData: (previousData) => previousData || initialData, // ✅ Manter dados anteriores visíveis durante refetch
    staleTime: 1 * 60 * 1000, // 1 minuto (dados do dia atual mudam frequentemente)
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
  });
}

/**
 * Hook para carregar pedidos com filtros e paginação otimizada
 * Carrega apenas campos necessários para melhor performance
 * Cache: 5 minutos
 */
export function useOrders(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
}) {
  // ✅ CORREÇÃO: Se page/pageSize não forem fornecidos, carregar tudo
  const usePagination = filters?.page !== undefined && filters?.pageSize !== undefined;
  const page = filters?.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Carregar apenas campos que existem em todos os pedidos
      let baseQuery = supabase
        .from("orders")
        .select(`
          id,
          customer_email,
          customer_whatsapp,
          status,
          plan,
          amount_cents,
          created_at,
          paid_at,
          payment_provider
        `, { count: 'exact' })
        .order("created_at", { ascending: false });
      
      // Aplicar filtros na query do Supabase
      if (filters?.status && filters.status !== 'all') {
        baseQuery = baseQuery.eq('status', filters.status);
      }
      
      if (filters?.plan && filters.plan !== 'all') {
        baseQuery = baseQuery.eq('plan', filters.plan);
      }
      
      if (filters?.provider && filters.provider !== 'all') {
        baseQuery = baseQuery.eq('payment_provider', filters.provider);
      }
      
      // ✅ BUSCA OTIMIZADA: Buscar por email, telefone, nome ou ID
      let allOrders: any[] = [];
      
      if (filters?.search) {
        const searchTerm = filters.search.trim();
        
        // Verificar se o termo parece ser um UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
        
        if (isUUID) {
          // Busca direta por UUID (mais rápida)
          const { data, error } = await baseQuery.eq('id', searchTerm).limit(1);
          if (error) throw error;
          allOrders = data || [];
        } else {
          // ✅ CORREÇÃO: Buscar TODOS os resultados quando não há paginação
          const phoneSearchTerm = searchTerm.replace(/[\s\-()+]/g, '');

          // Buscar todos os resultados (sem limite)
          const { data: emailData, error: emailError } = await supabase
            .from("orders")
            .select(`
              id,
              customer_email,
              customer_whatsapp,
              status,
              plan,
              amount_cents,
              created_at,
              paid_at,
              payment_provider
            `)
            .ilike('customer_email', `%${searchTerm}%`)
            .order("created_at", { ascending: false });

          if (emailError) {
            console.error(`❌ Erro ao buscar por email:`, emailError);
          }

          const { data: phoneData, error: phoneError } = await supabase
            .from("orders")
            .select(`
              id,
              customer_email,
              customer_whatsapp,
              status,
              plan,
              amount_cents,
              created_at,
              paid_at,
              payment_provider
            `)
            .ilike('customer_whatsapp', `%${phoneSearchTerm}%`)
            .order("created_at", { ascending: false });

          if (phoneError) {
            console.error(`❌ Erro ao buscar por telefone:`, phoneError);
          }
          
          const combinedResults = new Map();

          (emailData || []).forEach((order: any) => combinedResults.set(order.id, order));
          (phoneData || []).forEach((order: any) => combinedResults.set(order.id, order));

          allOrders = Array.from(combinedResults.values());
          
          // ✅ Aplicar filtros DEPOIS de buscar
          if (filters?.status && filters.status !== 'all') {
            allOrders = allOrders.filter(o => o.status === filters.status);
          }
          
          if (filters?.plan && filters.plan !== 'all') {
            allOrders = allOrders.filter(o => o.plan === filters.plan);
          }
          
          if (filters?.provider && filters.provider !== 'all') {
            allOrders = allOrders.filter(o => o.payment_provider === filters.provider);
          }
        }
      } else {
        // ✅ CORREÇÃO: Sem busca, carregar tudo se não houver paginação
        if (!usePagination) {
          // Carregar tudo usando paginação interna do Supabase
          let allData: any[] = [];
          let from = 0;
          const pageSize = 1000;
          let hasMore = true;
          
          while (hasMore) {
            const { data, error, count } = await baseQuery.range(from, from + pageSize - 1);
            
            if (error) {
              console.error(`❌ Erro ao carregar pedidos:`, error);
              throw error;
            }
            
            if (data && data.length > 0) {
              allData = allData.concat(data);
              from += pageSize;
              hasMore = data.length === pageSize;
            } else {
              hasMore = false;
            }
          }
          
          allOrders = allData;
          const totalCount = allOrders.length;
          
          return { orders: allOrders, total: totalCount };
        } else {
          // Com paginação, carregar página atual
          const { data, error, count } = await baseQuery.range(from, to);

          if (error) {
            console.error(`❌ Erro ao carregar pedidos paginados:`, error);
            throw error;
          }

          allOrders = data || [];
          const totalCount = count ?? allOrders.length;

          return { orders: allOrders, total: totalCount };
        }
      }
      
      // ✅ CORREÇÃO: Usar o número real de pedidos carregados
      const finalTotal = allOrders.length;
      
      return { orders: allOrders, total: finalTotal };
    },
    staleTime: 3 * 60 * 1000, // ✅ OTIMIZAÇÃO: Cache de 3 minutos (reduz requisições)
    gcTime: 10 * 60 * 1000, // ✅ OTIMIZAÇÃO: 10 minutos (mantém cache por mais tempo)
    refetchOnMount: false, // ✅ OTIMIZAÇÃO: Usar cache quando disponível
    refetchOnWindowFocus: false, // ✅ Não recarregar ao focar (melhor UX)
    refetchInterval: false, // ✅ CORREÇÃO: Não recarregar em segundo plano
    retry: 1, // ✅ OTIMIZAÇÃO: Retry reduzido para falhas rápidas
    retryDelay: 1000,
  });
}

/**
 * Hook para buscar estatísticas agregadas de pedidos (contagens e somas)
 * Usa count: 'exact' e agregações SQL para performance - não carrega dados completos
 * Cache: 2 minutos
 */
export function useOrdersStats(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
}) {
  // ✅ OTIMIZAÇÃO: Verificar se há filtros - se não houver, usar dados do dashboard
  const hasFilters = filters?.search || 
                     (filters?.status && filters.status !== 'all') ||
                     (filters?.plan && filters.plan !== 'all') ||
                     (filters?.provider && filters.provider !== 'all');
  
  return useQuery({
    queryKey: queryKeys.orders.stats(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO CRÍTICA: Se não há filtros, usar dados do dashboard do cache
      // Isso evita recalcular milhões de pedidos - ganho de performance de 10-100x
      if (!hasFilters) {
        try {
          // Tentar pegar do cache global do React Query (sem fazer requisição)
          const cachedData = queryClient.getQueryData(queryKeys.dashboard.stats());
          
          if (cachedData && typeof cachedData === 'object') {
            const dashboard = cachedData as any;
            // Calcular pending baseado no total - paid (aproximado, mas rápido)
            const pending = Math.max(0, (dashboard.totalOrders || 0) - (dashboard.paidOrders || 0));
            
            return {
              total: dashboard.totalOrders || 0,
              paid: dashboard.paidOrders || 0,
              totalPaid: dashboard.totalRevenueBRLConverted || 0,
              pending: pending,
              conversionRate: dashboard.totalOrders > 0 
                ? ((dashboard.paidOrders || 0) / dashboard.totalOrders) * 100 
                : 0
            };
          }
        } catch (error) {
          // Se falhar, continuar com busca normal abaixo
        }
      }
      // Se houver busca textual, precisamos buscar os resultados e calcular
      // (limitação do Supabase para buscas textuais com count)
      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
        
        let allOrderIds: string[] = [];
        
        if (isUUID) {
          // Busca por UUID - buscar apenas o ID
          const { data } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .eq('id', searchTerm)
            .limit(1);
          
          if (data && data.length > 0) {
            allOrderIds = [data[0].id];
          }
        } else {
          // Busca por email ou telefone - buscar IDs paginados
          const phoneSearchTerm = searchTerm.replace(/[\s\-()+]/g, '');
          
          // Buscar por email
          const { data: emailData } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .ilike('customer_email', `%${searchTerm}%`)
            .limit(10000); // Limite alto para buscar todos os resultados
          
          // Buscar por telefone
          const { data: phoneData } = await supabase
            .from("orders")
            .select("id, status, amount_cents")
            .ilike('customer_whatsapp', `%${phoneSearchTerm}%`)
            .limit(10000);
          
          // Combinar resultados únicos
          const combinedMap = new Map();
          (emailData || []).forEach((order: any) => combinedMap.set(order.id, order));
          (phoneData || []).forEach((order: any) => combinedMap.set(order.id, order));
          
          allOrderIds = Array.from(combinedMap.keys());
        }
        
        // Aplicar filtros adicionais nos resultados encontrados
        const filteredOrderIds = allOrderIds;
        
        // Buscar dados completos dos pedidos encontrados para aplicar filtros
        if (allOrderIds.length > 0) {
          let query = supabase
            .from("orders")
            .select("id, status, plan, payment_provider, amount_cents")
            .in('id', allOrderIds);
          
          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          
          if (filters?.plan && filters.plan !== 'all') {
            query = query.eq('plan', filters.plan);
          }
          
          if (filters?.provider && filters.provider !== 'all') {
            query = query.eq('payment_provider', filters.provider);
          }
          
          const { data: filteredData } = await query;
          
          if (filteredData) {
            // Calcular estatísticas dos resultados filtrados
            const total = filteredData.length;
            const paid = filteredData.filter(o => o.status === 'paid');
            const totalPaid = paid.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;
            const pending = filteredData.filter(o => o.status === 'pending').length;
            const conversionRate = total > 0 ? (paid.length / total) * 100 : 0;
            
            return {
              total,
              paid: paid.length,
              totalPaid,
              pending,
              conversionRate
            };
          }
        }
        
        // Se não encontrou nada, retornar zeros
        return {
          total: 0,
          paid: 0,
          totalPaid: 0,
          pending: 0,
          conversionRate: 0
        };
      }
      
      // Sem busca textual - usar count: 'exact' com fallback para paginação (mesma lógica do dashboard)
      let total = 0;
      let paid = 0;
      let pending = 0;
      
      try {
        // Tentar count exact primeiro
        const buildBaseQuery = () => {
          let query = supabase.from("orders").select("id", { count: 'exact', head: true });
          
          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          
          if (filters?.plan && filters.plan !== 'all') {
            query = query.eq('plan', filters.plan);
          }
          
          if (filters?.provider && filters.provider !== 'all') {
            query = query.eq('payment_provider', filters.provider);
          }
          
          return query;
        };
        
        const [
          totalResult,
          paidResult,
          pendingResult
        ] = await Promise.all([
          buildBaseQuery(),
          buildBaseQuery().eq('status', 'paid'),
          buildBaseQuery().eq('status', 'pending')
        ]);
        
        total = totalResult.count ?? 0;
        paid = paidResult.count ?? 0;
        pending = pendingResult.count ?? 0;
        
        // ✅ CORREÇÃO: Se o count retornar um valor suspeitamente baixo ou null, usar paginação
        // Mesma lógica do useDashboardStats
        if (!totalResult.count || totalResult.count < 50000) {
          // Contar via paginação (mais lento mas preciso)
          total = await countOrdersPaginated({
            status: filters?.status !== 'all' ? filters.status : undefined,
            provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
          
          paid = await countOrdersPaginated({ 
            status: 'paid',
            provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
          
          pending = await countOrdersPaginated({ 
            status: 'pending',
            provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
            plan: filters?.plan !== 'all' ? filters.plan : undefined
          });
        }
      } catch (error) {
        console.error('Erro ao contar pedidos com count exact, usando paginação:', error);
        // Fallback para contagem via paginação
        total = await countOrdersPaginated({
          status: filters?.status !== 'all' ? filters.status : undefined,
          provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
        
        paid = await countOrdersPaginated({ 
          status: 'paid',
          provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
        
        pending = await countOrdersPaginated({ 
          status: 'pending',
          provider: filters?.provider !== 'all' ? (filters.provider as 'stripe' | 'cakto') : undefined,
          plan: filters?.plan !== 'all' ? filters.plan : undefined
        });
      }
      
      // ✅ OTIMIZAÇÃO: Buscar soma de valores pagos de forma mais eficiente
      // Se não há filtros, usar dados do dashboard (já em cache)
      // Se há filtros, buscar apenas o necessário
      let totalPaid = 0;
      
      if (paid > 0) {
        // Se não há filtros de plan ou provider, podemos usar dados do dashboard
        const hasPlanFilter = filters?.plan && filters.plan !== 'all';
        const hasProviderFilter = filters?.provider && filters.provider !== 'all';
        
        if (!hasPlanFilter && !hasProviderFilter) {
          // ✅ OTIMIZAÇÃO: Sem filtros - buscar ambos providers em paralelo
          // Com cache de 5 minutos, isso não será chamado frequentemente
          const [stripeRevenue, caktoRevenue] = await Promise.all([
            fetchRevenueAggregate({ provider: 'stripe' }),
            fetchRevenueAggregate({ provider: 'cakto' }),
          ]);
          totalPaid = caktoRevenue + (stripeRevenue * 5.5);
        } else if (hasProviderFilter && !hasPlanFilter) {
          // Apenas filtro de provider
          const providerRevenue = await fetchRevenueAggregate({
            provider: filters.provider as 'stripe' | 'cakto'
          });
          
          if (filters.provider === 'stripe') {
            totalPaid = providerRevenue * 5.5;
          } else {
            totalPaid = providerRevenue;
          }
        } else {
          const planValue = hasPlanFilter ? filters!.plan : undefined;

          if (hasProviderFilter) {
            const provider = filters!.provider as 'stripe' | 'cakto';
            const revenue = await fetchRevenueAggregate({ provider, plan: planValue });
            totalPaid = provider === 'stripe' ? revenue * 5.5 : revenue;
          } else {
            const [stripeRevenue, caktoRevenue] = await Promise.all([
              fetchRevenueAggregate({ provider: 'stripe', plan: planValue }),
              fetchRevenueAggregate({ provider: 'cakto', plan: planValue }),
            ]);
            totalPaid = caktoRevenue + (stripeRevenue * 5.5);
          }
        }
      }
      
      const conversionRate = total > 0 ? (paid / total) * 100 : 0;
      
      return {
        total,
        paid,
        totalPaid,
        pending,
        conversionRate
      };
    },
    staleTime: 5 * 60 * 1000, // ✅ OTIMIZAÇÃO: 5 minutos (dados não mudam tão rápido)
    gcTime: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: 15 minutos (mantém cache por mais tempo)
    refetchOnMount: false, // ✅ Não refetch ao montar (usa cache)
    refetchOnWindowFocus: false, // ✅ Não refetch ao focar
    refetchOnReconnect: false, // ✅ Não refetch ao reconectar
    placeholderData: (previousData) => previousData, // ✅ Mostrar dados anteriores enquanto carrega
    retry: 1,
    retryDelay: 1000,
  });
}

/**
 * Hook para carregar releases (músicas prontas para enviar)
 * Cache: 3 minutos
 */
export function useReleases() {
  return useQuery({
    queryKey: queryKeys.releases.list(),
    queryFn: async () => {
      const { data: songs, error } = await supabase
        .from('songs')
        .select(`
          id,
          order_id,
          quiz_id,
          title,
          variant_number,
          status,
          audio_url,
          cover_url,
          lyrics,
          release_at,
          created_at,
          quiz_id
        `)
        .eq('status', 'ready')
        .is('released_at', null)
        .not('audio_url', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const songsWithAudio = songs?.filter(s => s.audio_url && s.audio_url.trim() !== '') || [];
      
      if (songsWithAudio.length === 0) {
        return [];
      }
      
      // Buscar orders, quizzes e jobs
      const orderIds = [...new Set(songsWithAudio.map(s => s.order_id).filter(Boolean))];
      const quizIds = [...new Set(songsWithAudio.map(s => s.quiz_id).filter(Boolean))];
      
      // ✅ OTIMIZAÇÃO: Buscar email_logs de forma eficiente
      // Limitar a busca para evitar URLs muito longas (máximo 100 order_ids por vez)
      // Como estamos ordenando por created_at desc, os primeiros são os mais recentes
      const MAX_ORDER_IDS_FOR_EMAIL_LOGS = 100;
      const limitedOrderIds = orderIds.slice(0, MAX_ORDER_IDS_FOR_EMAIL_LOGS);
      
      const [ordersData, quizzesData, jobsData, emailLogsResult] = await Promise.all([
        supabase.from('orders').select('id, customer_email, customer_whatsapp, plan, magic_token, quiz_id').in('id', orderIds),
        supabase.from('quizzes').select('id, about_who, style').in('id', quizIds),
        supabase.from('jobs').select('id, order_id, created_at, suno_task_id').in('order_id', orderIds).order('created_at', { ascending: false }),
        // Buscar logs apenas para os primeiros order_ids (mais recentes)
        // Isso evita URLs muito longas que causam erro 400
        limitedOrderIds.length > 0 
          ? supabase.from('email_logs')
              .select('song_id, order_id, status, sent_at')
              .in('order_id', limitedOrderIds)
              .eq('email_type', 'music_released')
          : Promise.resolve({ data: [], error: null })
      ]);
      
      const emailLogs = emailLogsResult;
      
      
      const ordersMap = new Map(ordersData.data?.map(o => [o.id, o]) || []);
      const quizzesMap = new Map(quizzesData.data?.map(q => [q.id, q]) || []);
      const emailMap = new Map();
      // ✅ CORREÇÃO: Verificar se emailLogs tem dados antes de processar
      if (emailLogs.data && !emailLogs.error) {
        emailLogs.data.forEach((log: any) => {
          if (log.song_id) {
        emailMap.set(log.song_id, { status: log.status, sent_at: log.sent_at });
          }
      });
      }
      
      // ✅ CORREÇÃO: Agrupar músicas por job (não por email)
      // Para cada order_id, pegar apenas as 2 músicas do job mais recente
      // Músicas do mesmo job são criadas quase simultaneamente (mesma requisição Suno)
      
      // Agrupar músicas por order_id
      const groupedByOrder = new Map<string, any[]>();
      songsWithAudio.forEach((song: any) => {
        if (!groupedByOrder.has(song.order_id)) {
          groupedByOrder.set(song.order_id, []);
        }
        groupedByOrder.get(song.order_id)!.push(song);
      });
      
      // Para cada order_id, pegar apenas as 2 músicas mais recentes do job mais recente
      const finalGroups = new Map<string, any>();
      
      groupedByOrder.forEach((songs, orderId) => {
        const order = ordersMap.get(orderId) as any;
        if (!order) return;
        
        // Ordenar músicas por created_at (mais recente primeiro)
        const sortedSongs = [...songs].sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        // ✅ CORREÇÃO: Agrupar músicas que foram criadas juntas (mesmo job = mesma requisição)
        // Músicas do mesmo job são criadas quase simultaneamente (diferença < 1 minuto)
        // e têm variant_number sequenciais (1 e 2, ou 3 e 4, etc.)
        // IMPORTANTE: Cada job gera exatamente 2 músicas (variants 1 e 2)
        const jobGroups: any[][] = [];
        let currentGroup: any[] = [];
        let lastCreatedAt: number | null = null;
        let lastVariantNumber: number | null = null;
        
        sortedSongs.forEach((song: any) => {
          const songCreatedAt = new Date(song.created_at || 0).getTime();
          const songVariant = song.variant_number || 0;
          
          // Verificar se faz parte do mesmo job:
          // 1. Criadas juntas (diferença < 1 minuto - mais restritivo)
          // 2. Variant numbers sequenciais (diferença exata de 1: 1-2, 3-4, etc.)
          // 3. Limitar grupo a no máximo 2 músicas (cada job gera 2 músicas)
          const timeDiff = lastCreatedAt ? (lastCreatedAt - songCreatedAt) : 0;
          const isWithinTimeWindow = lastCreatedAt === null || timeDiff < 60 * 1000; // 1 minuto
          const isSequential = lastVariantNumber === null || Math.abs(songVariant - lastVariantNumber) === 1; // Diferença exata de 1
          const groupNotFull = currentGroup.length < 2; // Limitar a 2 músicas
          
          const isSameJob = isWithinTimeWindow && isSequential && groupNotFull;
          
          if (isSameJob) {
            // Mesmo job (criadas juntas, variants sequenciais e grupo ainda não completo)
            currentGroup.push(song);
          } else {
            // Novo job - finalizar grupo anterior e começar novo
            if (currentGroup.length > 0) {
              jobGroups.push(currentGroup);
            }
            currentGroup = [song];
          }
          lastCreatedAt = songCreatedAt;
          lastVariantNumber = songVariant;
        });
        
        if (currentGroup.length > 0) {
          jobGroups.push(currentGroup);
        }
        
        // ✅ CORREÇÃO: Pegar apenas o grupo mais recente (primeiro) e garantir exatamente 2 músicas
        // Se o grupo tiver mais de 2, pegar apenas as 2 mais recentes
        // Se o grupo tiver menos de 2, não criar card
        if (jobGroups.length > 0) {
          const mostRecentJobSongs = jobGroups[0].slice(0, 2);
          
          // ✅ VALIDAÇÃO CRÍTICA: Apenas criar card se tiver exatamente 2 músicas do job mais recente
          if (mostRecentJobSongs.length === 2) {
            const quiz = mostRecentJobSongs[0].quiz_id ? quizzesMap.get(mostRecentJobSongs[0].quiz_id) as any : null;
            const orderQuiz = order?.quiz_id ? quizzesMap.get(order.quiz_id) as any : null;
            const finalQuiz = quiz || orderQuiz;
            
            const enrichedSongs = mostRecentJobSongs.map((song: any) => {
              const emailInfo = emailMap.get(song.id);
              return {
                ...song,
                email_sent: emailInfo?.status === 'sent' || emailInfo?.status === 'delivered',
                email_sent_at: emailInfo?.sent_at
              };
            });
            
            const groupKey = order.customer_email || 'Email não encontrado';
            
            finalGroups.set(groupKey, {
              songs: enrichedSongs,
              email: order.customer_email || 'Email não encontrado',
              customer_whatsapp: order.customer_whatsapp || null,
              about: finalQuiz?.about_who || 'N/A',
              plan: order.plan || 'unknown',
              magic_token: order.magic_token || null,
              order_ids: [orderId]
            });
          }
        }
      });
      
      return Array.from(finalGroups.entries()).map(([id, data]) => ({
        id,
        ...data
      }));
    },
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para mutation de release (liberar e enviar músicas)
 */
export function useReleaseMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: string | string[] | { orderIds: string | string[], songs?: any[] }) => {
      const startTime = Date.now();
      
      try {
        // ✅ CORREÇÃO: Aceitar orderIds (string/array) ou objeto com orderIds e songs
        let orderIds: string | string[];
        let preloadedSongs: any[] | undefined;
        
        if (typeof params === 'string' || Array.isArray(params)) {
          // Formato antigo: apenas orderIds
          orderIds = params;
          preloadedSongs = undefined;
        } else {
          // Formato novo: objeto com orderIds e songs
          orderIds = params.orderIds;
          preloadedSongs = params.songs;
        }
        
        // ✅ CORREÇÃO: Validar orderIds antes de processar
        if (!orderIds) {
          console.error('❌ [Release] orderIds é null/undefined');
          throw new Error('IDs dos pedidos não fornecidos');
        }
        
      const orderIdsArray = Array.isArray(orderIds) ? orderIds : [orderIds];
        
        // ✅ CORREÇÃO: Validar que todos os IDs são válidos
        const validOrderIds = orderIdsArray.filter(id => id && typeof id === 'string' && id.trim() !== '');
        
        if (validOrderIds.length === 0) {
          console.error('❌ [Release] Nenhum ID válido após filtro');
          throw new Error('Nenhum ID de pedido válido fornecido');
        }
      
        // ✅ CORREÇÃO CRÍTICA: Usar músicas pré-carregadas se disponíveis (evita query lenta)
        let songs, fetchError;
        
        if (preloadedSongs && preloadedSongs.length > 0) {
          songs = preloadedSongs.filter((s: any) => 
            s.status === 'ready' && 
            !s.released_at && 
            s.audio_url && 
            validOrderIds.includes(s.order_id)
          );
        } else {
          // ✅ FALLBACK: Buscar músicas apenas se não foram pré-carregadas
          const fetchStart = Date.now();
          
          // ✅ ESTRATÉGIA: Tentar Edge Function primeiro (mais rápido, bypass RLS)
          try {
            const edgeFunctionPromise = supabase.functions.invoke('admin-get-ready-songs', {
              body: { orderIds: validOrderIds }
            });
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => {
                reject(new Error('Edge Function timeout'));
              }, 8000)
            );
            
            const result = await Promise.race([edgeFunctionPromise, timeoutPromise]) as any;
            
            if (result.error) {
              throw result.error;
            }
            
            if (result.data?.songs) {
              songs = result.data.songs;
            } else {
              throw new Error('Resposta inesperada da Edge Function');
            }
            
          } catch (edgeError: any) {
            // ✅ FALLBACK: Query direta com timeout
            try {
              let query = supabase
            .from('songs')
                .select('id, variant_number, title, audio_url, status, order_id, released_at, created_at');
              
              if (validOrderIds.length === 1) {
                query = query.eq('order_id', validOrderIds[0]);
              } else {
                query = query.in('order_id', validOrderIds);
              }
              
              const queryPromise = query
            .eq('status', 'ready')
            .is('released_at', null)
                .order('created_at', { ascending: false })
                .limit(20);
              
              // ✅ CORREÇÃO CRÍTICA: Adicionar timeout de 8 segundos
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                  reject(new Error('Timeout: Query direta demorou mais de 8 segundos'));
                }, 8000)
              );
              
              const result = await Promise.race([queryPromise, timeoutPromise]) as any;
              
              songs = result.data;
              fetchError = result.error;
            } catch (queryError: any) {
              const fetchTime = Date.now() - fetchStart;
              console.error('❌ [Release] Erro na query direta do Supabase:', queryError);
              console.error('❌ [Release] Tempo decorrido antes do erro:', fetchTime, 'ms');
              console.error('❌ [Release] Error message:', queryError?.message);
              console.error('❌ [Release] Error name:', queryError?.name);
              console.error('❌ [Release] Stack trace:', queryError?.stack);
              fetchError = queryError;
            }
          }
        }
        
      
        if (fetchError) {
          console.error('❌ [Release] Erro ao buscar músicas:', fetchError);
          console.error('❌ [Release] Stack trace:', new Error().stack);
          throw new Error(`Erro ao buscar músicas: ${fetchError.message || fetchError.toString()}`);
        }
        
        if (!songs || songs.length === 0) {
          throw new Error('Nenhuma música pronta encontrada para liberar');
        }
      
      // ✅ CORREÇÃO: Filtrar músicas com áudio primeiro
      const songsWithAudio = songs.filter(s => s.audio_url && s.audio_url.trim() !== '');
        
        if (songsWithAudio.length === 0) {
          console.error('❌ [Release] Nenhuma música com áudio encontrada');
          throw new Error('Nenhuma música com áudio');
        }
      
      // ✅ CORREÇÃO: Se houver mais de 2 músicas, selecionar apenas as 2 mais recentes
      // Ordenar por created_at (mais recente primeiro) ou variant_number (maior = mais recente)
      let songsToRelease = songsWithAudio;
      if (songsWithAudio.length > 2) {
        // Ordenar por created_at descendente (mais recente primeiro) ou variant_number descendente
        songsToRelease = [...songsWithAudio].sort((a, b) => {
          // Tentar ordenar por created_at primeiro, se disponível
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          // Fallback: ordenar por variant_number (maior = mais recente)
          return (b.variant_number || 0) - (a.variant_number || 0);
        }).slice(0, 2); // Pegar apenas as 2 primeiras (mais recentes)
      }
      
      // ✅ VALIDAÇÃO: Garantir que temos pelo menos 1 música para liberar
      // Removida validação rígida de 2 músicas - pode liberar com 1 ou mais
      if (songsToRelease.length < 1) {
          console.error(`❌ [Release] Nenhuma música para liberar: ${songsToRelease.length}`);
        throw new Error(`Nenhuma música válida encontrada para liberar.`);
      }
      
      // Atualizar para released
      const updateStart = Date.now();
      const now = new Date().toISOString();
      const songIds = songsToRelease.map(s => s.id);
      
        let updatedSongs, updateError;
        try {
          const result = await supabase
        .from('songs')
        .update({ 
          released_at: now, 
          status: 'released',
          updated_at: now
        })
        .in('id', songIds)
        .select();
          
          updatedSongs = result.data;
          updateError = result.error;
        } catch (updateErr: any) {
          console.error('❌ [Release] Erro na atualização:', updateErr);
          updateError = updateErr;
        }
        
        if (updateError) {
          console.error('❌ [Release] Erro ao atualizar músicas:', updateError);
          console.error('❌ [Release] Stack trace:', new Error().stack);
          throw new Error(`Erro ao atualizar músicas: ${updateError.message || updateError.toString()}`);
        }
        
        if (!updatedSongs || updatedSongs.length === 0) {
          console.error('❌ [Release] Nenhuma música foi atualizada');
          throw new Error('Nenhuma música foi atualizada');
        }
      
        // ✅ CORREÇÃO CRÍTICA: Usar songsToRelease[0] ao invés de songsWithAudio[0]
        // songsToRelease são as músicas selecionadas para release (2 mais recentes)
      const firstSong = songsToRelease[0]; // ✅ CORREÇÃO: Usar songsToRelease
      const orderIdForEmail = firstSong.order_id || validOrderIds[0];
      
        // Buscar dados completos do pedido (email, telefone, quiz)
        let order, orderError;
        try {
          const result = await supabase
        .from('orders')
        .select(`
          customer_email,
          customer_whatsapp,
          plan,
          magic_token,
          quiz_id,
          quizzes:quiz_id (
            about_who
          )
        `)
        .eq('id', orderIdForEmail)
        .single();
          
          order = result.data;
          orderError = result.error;
        } catch (err: any) {
          console.error('❌ [Release] Erro ao buscar order:', err);
          orderError = err;
        }
        
        if (orderError) {
          console.error('❌ [Release] Erro ao buscar order:', orderError);
        }
      
      if (!order?.customer_email) {
        toast.warning(`Músicas liberadas, mas email do cliente não encontrado.`);
          // Ainda retornar sucesso pois as músicas foram liberadas
        return updatedSongs;
      }
      
        // ✅ CORREÇÃO CRÍTICA: Aguardar envio do email com timeout para evitar travamento
        const emailStart = Date.now();
        
        // Preparar dados para webhook
        const about = (order?.quizzes as any)?.about_who || 'N/A';
        
        try {
          // ✅ NOVO: Enviar email e webhook em paralelo
          const emailPromise = supabase.functions.invoke(
            'send-music-released-email',
            {
              body: {
                songId: firstSong.id,
                orderId: orderIdForEmail,
                force: true
              }
            }
          );
          
          const emailTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Envio de email demorou mais de 15 segundos')), 15000)
          );
          
          // Chamar webhook em paralelo (não bloqueante)
          const webhookPromise = order ? sendReleaseWebhook(
            {
              id: orderIdForEmail,
              customer_email: order.customer_email || '',
              customer_whatsapp: order.customer_whatsapp || null,
              plan: order.plan || 'unknown',
              magic_token: order.magic_token || ''
            },
            songsToRelease.map(s => ({
              id: s.id,
              title: s.title || 'Música sem título',
              variant_number: s.variant_number || 1,
              audio_url: s.audio_url || undefined
            })),
            about
          ) : Promise.resolve();
          
          // Executar email e webhook em paralelo
          const [emailResult, webhookResult] = await Promise.allSettled([
            Promise.race([emailPromise, emailTimeout]),
            webhookPromise
          ]);
          
          // Processar resultado do email
          let emailData, emailError;
          if (emailResult.status === 'fulfilled') {
            const result = emailResult.value as any;
            emailData = result.data;
            emailError = result.error;
          } else {
            emailError = emailResult.reason;
          }
          
          // Processar resultado do webhook (não bloquear)
          if (webhookResult.status === 'rejected') {
            console.error('❌ [Release] [Webhook] Erro ao enviar webhook (não bloqueante):', webhookResult.reason);
          }
        
        if (emailError) {
            throw new Error(`Erro ao enviar email: ${emailError.message || 'Erro desconhecido'}`);
        }
        
        // ✅ CORREÇÃO: Verificar resposta da Edge Function corretamente
        if (emailData && (emailData.success === true || emailData.email_id)) {
            toast.success(`✅ ${updatedSongs.length} música(s) liberada(s) e email enviado para ${order.customer_email}!`);
        } else {
            // Tentar adicionar à fila como fallback antes de lançar erro
            try {
              await supabase.from('email_queue').insert({
                order_id: orderIdForEmail,
                song_id: firstSong.id,
                recipient_email: order.customer_email,
                status: 'pending',
                next_retry_at: new Date().toISOString(),
                metadata: {
                  song_title: firstSong.title,
                  variant_number: firstSong.variant_number,
                  fallback_reason: emailData?.error || 'Resposta inesperada da função de envio'
                }
              });
              
              toast.warning(`Músicas liberadas, mas houve problema ao enviar email. Email será enviado em breve.`);
            } catch (queueError: any) {
              console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueError);
              toast.warning(`Músicas liberadas, mas houve problema ao enviar email. Verifique os logs.`);
            }
        }
        
      } catch (emailError: any) {
          // Tentar adicionar à fila como fallback
        try {
          const queueResult = await supabase.from('email_queue').insert({
            order_id: orderIdForEmail,
            song_id: firstSong.id,
            recipient_email: order.customer_email,
            status: 'pending',
            next_retry_at: new Date().toISOString(),
            metadata: {
              song_title: firstSong.title,
              variant_number: firstSong.variant_number,
                fallback_reason: emailError?.message || 'Erro desconhecido'
            }
          });
          
          if (queueResult.error) {
            console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueResult.error);
          }
          
          toast.warning(`Músicas liberadas, mas houve erro ao enviar email. Email será enviado em breve.`);
        } catch (queueError: any) {
            console.error("❌ [Release] [Email] Erro ao adicionar à fila:", queueError);
            toast.warning(`Músicas liberadas, mas houve erro ao enviar email: ${emailError?.message || 'Erro desconhecido'}`);
        }
          
          // ✅ CORREÇÃO CRÍTICA: Não lançar erro - músicas já foram liberadas
          // Apenas logar o erro para debug, mas continuar o fluxo
          // Isso garante que onSuccess seja chamado e o card saia do loading
      }
      
      return updatedSongs;
        
      } catch (error: any) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ [Release] ===== ERRO NA MUTATION =====`);
        console.error(`❌ [Release] Erro capturado:`, error);
        console.error(`❌ [Release] Error message:`, error?.message);
        console.error(`❌ [Release] Error stack:`, error?.stack);
        console.error(`⏱️ [Release] Total time antes do erro: ${totalTime}ms`);
        console.error(`🚀 [Release] ===== FIM DA MUTATION (erro) =====`);
        // Re-lançar o erro para que o onError do mutation possa tratá-lo
        throw error;
      }
    },
    onSuccess: (data) => {
      
      try {
        // ✅ CORREÇÃO: Invalidar cache imediatamente e forçar refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.songs.all });
        
        // Forçar refetch imediato para atualizar a UI
        queryClient.refetchQueries({ queryKey: queryKeys.releases.all })
          .then(() => {
          })
          .catch((error) => {
            console.error('❌ [Release] [onSuccess] Erro ao refetch:', error);
            console.error('❌ [Release] [onSuccess] Stack:', error?.stack);
          });
      } catch (cacheError: any) {
        console.error('❌ [Release] [onSuccess] Erro ao invalidar cache:', cacheError);
        console.error('❌ [Release] [onSuccess] Stack:', cacheError?.stack);
      }
    },
    onError: (error: any) => {
      console.error('❌ [Release] [onError] Mutation erro capturado');
      console.error('❌ [Release] [onError] Error object:', error);
      console.error('❌ [Release] [onError] Error message:', error?.message);
      console.error('❌ [Release] [onError] Error toString:', error?.toString());
      console.error('❌ [Release] [onError] Stack trace:', error?.stack);
      
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
      console.error('❌ [Release] [onError] Mensagem de erro final:', errorMessage);
      
      toast.error(`Erro ao liberar músicas: ${errorMessage}`);
    },
  });
}

/**
 * Hook para carregar músicas com filtros otimizado
 * Carrega apenas campos necessários e limita lotes iniciais
 * Cache: 3 minutos
 */
export function useSongs(filters?: {
  search?: string;
  status?: string;
  period?: string;
}) {
  return useQuery({
    queryKey: queryKeys.songs.list(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Limitar inicialmente a 5000 músicas para melhor performance
      // Isso cobre ~2500 gerações (5000 músicas / 2 por geração)
      const maxSongs = 5000;
      let allSongs: any[] = [];
      let from = 0;
      const batchSize = 1000; // ✅ Lotes de 1000 para balancear velocidade e memória
      let hasMore = true;
      let batchCount = 0;
      const maxBatches = Math.ceil(maxSongs / batchSize); // ✅ Limitar a 5 lotes (5000 músicas)
      
      while (hasMore && batchCount < maxBatches && allSongs.length < maxSongs) {
        batchCount++;
        
        const query = supabase
          .from("songs")
          .select(`
            id,
            order_id,
            quiz_id,
            title,
            variant_number,
            status,
            audio_url,
            cover_url,
            release_at,
            released_at,
            created_at,
            updated_at,
            vocals_url,
            instrumental_url,
            stems_separated_at,
            orders:order_id(customer_email),
            quizzes:quiz_id(about_who, style)
          `)
          .in('status', ['approved', 'released'])
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`❌ Erro no lote ${batchCount}:`, error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allSongs = allSongs.concat(data);
          
          // Se retornou menos que o batch size, não há mais dados
          hasMore = data.length === batchSize;
          from += batchSize;
          
          // ✅ OTIMIZAÇÃO: Parar se já temos o suficiente
          if (allSongs.length >= maxSongs) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Carregadas ${allSongs.length} músicas em ${batchCount} lotes`);
      return allSongs;
    },
    staleTime: 3 * 60 * 1000, // ✅ 3 minutos de cache
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook para carregar pagamentos
 * Cache: 5 minutos
 */
/**
 * Hook para separar stems (vocals e instrumental) de uma música
 */
/**
 * Hook para consultar status de separação de stems
 */
export function useStemSeparationStatus(songId: string) {
  return useQuery({
    queryKey: ['stem-separation-status', songId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stem_separations')
        .select('*')
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // PGRST116 = no rows returned (normal, significa que não há separação ainda)
      // 404 = tabela não existe (migration não aplicada)
      if (error) {
        if (error.code === 'PGRST116') {
          // Não há separação ainda, retornar null
          return null;
        }
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          // Tabela não existe - migration não aplicada
          return null;
        }
        // Outro erro, lançar
        throw error;
      }

      return data;
    },
    enabled: !!songId,
    refetchInterval: (query) => {
      // Refetch a cada 5 segundos se estiver em processamento
      const data = query.state.data;
      if (data && (data.status === 'pending' || data.status === 'processing')) {
        return 5000;
      }
      return false;
    },
  });
}

/**
 * Hook para separar stems usando get-or-create-stems (Regra de Ouro #4)
 */
export function useSeparateStems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (songId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      // ✅ REGRA DE OURO #4: Usar get-or-create-stems que verifica se já existe separação
      const { data, error } = await supabase.functions.invoke('get-or-create-stems', {
        body: { song_id: songId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });


      if (error) {
        console.error('❌ [useSeparateStems] Erro na invocação:', error);
        let errorMessage = error.message || 'Erro desconhecido ao chamar Edge Function';
        
        if (error.status === 404) {
          errorMessage = 'Edge Function "get-or-create-stems" não encontrada. Verifique se está deployada no Supabase Dashboard.';
        } else if (error.status === 503 || errorMessage.includes('Failed to send a request')) {
          errorMessage = 'Não foi possível conectar à Edge Function. A função pode não estar deployada ou há um problema de rede.';
        } else if (error.status === 500) {
          errorMessage = 'Erro interno no servidor. Verifique os logs da Edge Function no Supabase Dashboard.';
        } else if (error.status) {
          errorMessage = `Erro ${error.status}: ${errorMessage}`;
        }
        
        throw new Error(errorMessage);
      }

      if (data && data.error) {
        console.error('❌ [useSeparateStems] Erro na resposta:', data.error);
        throw new Error(data.error || 'Erro desconhecido na separação de stems');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidar queries de songs e separações
      queryClient.invalidateQueries({ queryKey: queryKeys.songs.list() });
      queryClient.invalidateQueries({ queryKey: ['songs-with-stems'] });
      queryClient.invalidateQueries({ queryKey: ['stem-separation-status'] });
      
      // Mensagens baseadas no status retornado
      if (data?.status === 'completed') {
        toast.success('Stems já estavam separados e prontos!');
      } else if (data?.status === 'pending' || data?.status === 'processing') {
        toast.success('Separação de stems iniciada! Os resultados chegarão em alguns minutos.');
      } else {
        toast.success('Processo de separação iniciado!');
      }
    },
    onError: (error: any) => {
      console.error('❌ [useSeparateStems] Erro capturado:', error);
      const errorMessage = error.message || error.error || 'Erro desconhecido';
      toast.error(`Erro ao separar stems: ${errorMessage}`);
    }
  });
}

/**
 * Hook para buscar músicas com filtro de stems (OTIMIZADO com paginação)
 */
export function useSongsWithStems(filters?: {
  hasStems?: boolean; // true = apenas com stems, false = apenas sem stems, undefined = todas
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ['songs-with-stems', filters],
    queryFn: async () => {
      // Primeiro, buscar apenas IDs e contar total (para paginação)
      let countQuery = supabase
        .from("songs")
        .select('id', { count: 'exact', head: true })
        .not('audio_url', 'is', null);

      // Aplicar filtro de stems
      if (filters?.hasStems === true) {
        countQuery = countQuery.not('vocals_url', 'is', null).not('instrumental_url', 'is', null);
      } else if (filters?.hasStems === false) {
        countQuery = countQuery.or('vocals_url.is.null,instrumental_url.is.null');
      }

      // Aplicar filtro de busca (buscar por título primeiro, email será filtrado depois)
      if (filters?.search) {
        countQuery = countQuery.ilike('title', `%${filters.search}%`);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('❌ Erro ao contar músicas:', countError);
        throw countError;
      }

      // Agora buscar os dados paginados
      // Se houver busca, buscar mais resultados para poder filtrar por email depois
      const searchLimit = filters?.search ? pageSize * 3 : pageSize;
      const searchTo = from + searchLimit - 1;

      let query = supabase
        .from("songs")
        .select(`
          id,
          order_id,
          quiz_id,
          title,
          variant_number,
          status,
          audio_url,
          cover_url,
          release_at,
          released_at,
          created_at,
          updated_at,
          vocals_url,
          instrumental_url,
          stems_separated_at,
          orders:order_id(customer_email),
          quizzes:quiz_id(about_who, style)
        `)
        .not('audio_url', 'is', null)
        .order("created_at", { ascending: false })
        .range(from, searchTo);

      // Aplicar filtro de stems
      if (filters?.hasStems === true) {
        query = query.not('vocals_url', 'is', null).not('instrumental_url', 'is', null);
      } else if (filters?.hasStems === false) {
        query = query.or('vocals_url.is.null,instrumental_url.is.null');
      }

      // Aplicar filtro de busca por título
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar músicas:', error);
        throw error;
      }

      // Filtrar por email se houver busca (já que não podemos fazer OR com relacionamentos no Supabase)
      let filteredData = data || [];
      if (filters?.search && data) {
        const searchLower = filters.search.toLowerCase();
        filteredData = data.filter((song: any) => {
          const titleMatch = song.title?.toLowerCase().includes(searchLower);
          const emailMatch = (
            (Array.isArray(song.orders) ? song.orders[0]?.customer_email : song.orders?.customer_email) || ''
          ).toLowerCase().includes(searchLower);
          return titleMatch || emailMatch;
        });
      }

      // Aplicar paginação final (slice para garantir exatamente pageSize itens)
      const paginatedData = filteredData.slice(0, pageSize);

      // Ajustar total se houver busca (pode ser diferente devido ao filtro de email)
      // Para busca, usar o tamanho dos dados filtrados; caso contrário, usar o count
      const actualTotal = filters?.search ? filteredData.length : (count || 0);

      return {
        songs: paginatedData,
        total: actualTotal,
        page,
        pageSize,
        totalPages: Math.ceil(actualTotal / pageSize)
      };
    },
    staleTime: 30 * 1000, // 30 segundos (cache mais curto para dados mais frescos)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnMount: true, // Refetch ao montar para garantir dados atualizados
    refetchOnWindowFocus: true, // Refetch ao focar na janela
    retry: 1,
    retryDelay: 500,
    // Não usar refetchInterval aqui - deixar o componente controlar o polling quando necessário
  });
}

export function usePayments(filters?: {
  search?: string;
  status?: string;
  plan?: string;
  provider?: string;
  dateFilter?: string;
}) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Buscar pedidos com limite aumentado
      let allOrders: any[] = [];
      let from = 0;
      const pageSize = 1000;
      const maxOrders = 1000000; // Aumentado para suportar até 1 milhão de pedidos
      let hasMore = true;
      
      while (hasMore && allOrders.length < maxOrders) {
        let query = supabase
          .from('orders')
          .select(`
            id,
            status,
            plan,
            amount_cents,
            provider,
            stripe_checkout_session_id,
            stripe_payment_intent_id,
            created_at,
            paid_at,
            user_id,
            profiles!inner(display_name, email)
          `)
          .order('created_at', { ascending: false });
        
        // ✅ OTIMIZAÇÃO: Aplicar filtros na query (mais eficiente)
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        
        if (filters?.plan && filters.plan !== 'all') {
          query = query.eq('plan', filters.plan);
        }
        
        if (filters?.provider && filters.provider !== 'all') {
          query = query.eq('payment_provider', filters.provider);
        }
        
        const { data: pageData, error } = await query.range(from, from + pageSize - 1);
        
        if (error) throw error;
        
        if (pageData && pageData.length > 0) {
          allOrders = allOrders.concat(pageData);
          from += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allOrders;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

/**
 * Hook para carregar créditos Suno
 * Cache: 2 minutos
 */
export function useSunoCredits() {
  return useQuery({
    queryKey: queryKeys.dashboard.sunoCredits(),
    queryFn: async () => {
      // ✅ CORREÇÃO: Buscar pelo ID fixo usado pela função deduct_suno_credits
      const { data, error } = await supabase
        .from('suno_credits')
        .select('total_credits, used_credits, remaining_credits')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error) {
        // Se não existir registro, criar um inicial com ID fixo
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('suno_credits')
            .insert({ 
              id: '00000000-0000-0000-0000-000000000001',
              total_credits: 0, 
              used_credits: 0, 
              remaining_credits: 0 
            })
            .select()
            .single();
          
          if (insertError) throw insertError;
          
          return {
            total: newData.total_credits,
            used: newData.used_credits,
            remaining: newData.remaining_credits,
          };
        }
        throw error;
      }
      
      return {
        total: data.total_credits,
        used: data.used_credits,
        remaining: data.remaining_credits,
      };
    },
    staleTime: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: 15 minutos (créditos não mudam tão rápido)
    gcTime: 30 * 60 * 1000, // ✅ OTIMIZAÇÃO: 30 minutos
    refetchInterval: 15 * 60 * 1000, // ✅ OTIMIZAÇÃO: Atualizar a cada 15min (reduz Edge Requests)
  });
}

/**
 * Hook para dados estáticos (cache infinito)
 */
export function useStaticData<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  return useQuery({
    queryKey: [...queryKeys.static.all, key],
    queryFn: fetcher,
    staleTime: Infinity, // Nunca fica stale
    gcTime: Infinity, // Nunca é removido do cache
  });
}
