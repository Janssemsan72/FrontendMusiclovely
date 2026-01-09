import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  FinancialCategory,
  FixedCost,
  VariableCost,
  ApiCost,
  Refund,
  PixSale,
  Adjustment,
  PaidTraffic,
  CaktoSalesSummary,
  DailyFinancialSummary,
} from '@/types/admin';

// ==========================================
// QUERY KEYS
// ==========================================
const financialKeys = {
  all: ['financial'] as const,
  categories: () => [...financialKeys.all, 'categories'] as const,
  fixedCosts: (filters?: { month?: number; year?: number }) => 
    [...financialKeys.all, 'fixed-costs', filters] as const,
  variableCosts: (filters?: { startDate?: string; endDate?: string }) => 
    [...financialKeys.all, 'variable-costs', filters] as const,
  apiCosts: (filters?: { startDate?: string; endDate?: string; provider?: string }) => 
    [...financialKeys.all, 'api-costs', filters] as const,
  refunds: (filters?: { startDate?: string; endDate?: string; status?: string }) => 
    [...financialKeys.all, 'refunds', filters] as const,
  pixSales: (filters?: { startDate?: string; endDate?: string; status?: string }) => 
    [...financialKeys.all, 'pix-sales', filters] as const,
  adjustments: (filters?: { startDate?: string; endDate?: string; status?: string }) => 
    [...financialKeys.all, 'adjustments', filters] as const,
  paidTraffic: (filters?: { startDate?: string; endDate?: string; platform?: string }) => 
    [...financialKeys.all, 'paid-traffic', filters] as const,
  caktoSales: (filters?: { startDate?: string; endDate?: string }) => 
    [...financialKeys.all, 'cakto-sales', filters] as const,
  dailySummary: (filters?: { startDate?: string; endDate?: string }) => 
    [...financialKeys.all, 'daily-summary', filters] as const,
};

// ==========================================
// CATEGORIES
// ==========================================
export function useFinancialCategories() {
  return useQuery({
    queryKey: financialKeys.categories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as FinancialCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// FIXED COSTS
// ==========================================
export function useFixedCosts(filters?: { month?: number; year?: number }) {
  return useQuery({
    queryKey: financialKeys.fixedCosts(filters),
    queryFn: async () => {
      let query = supabase
        .from('fixed_costs')
        .select('*, category:financial_categories(*)')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (filters?.year) {
        query = query.eq('year', filters.year);
      }
      if (filters?.month) {
        query = query.eq('month', filters.month);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (FixedCost & { category?: FinancialCategory })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateFixedCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cost: Omit<FixedCost, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('fixed_costs')
        .insert({ ...cost, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as FixedCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.fixedCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo fixo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar custo fixo: ${error.message}`);
    },
  });
}

export function useUpdateFixedCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FixedCost> & { id: string }) => {
      const { data, error } = await supabase
        .from('fixed_costs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FixedCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.fixedCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo fixo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar custo fixo: ${error.message}`);
    },
  });
}

export function useDeleteFixedCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.fixedCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo fixo excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir custo fixo: ${error.message}`);
    },
  });
}

// ==========================================
// VARIABLE COSTS
// ==========================================
export function useVariableCosts(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: financialKeys.variableCosts(filters),
    queryFn: async () => {
      let query = supabase
        .from('variable_costs')
        .select('*, category:financial_categories(*)')
        .order('date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (VariableCost & { category?: FinancialCategory })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateVariableCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cost: Omit<VariableCost, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('variable_costs')
        .insert({ ...cost, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as VariableCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.variableCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo variável criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar custo variável: ${error.message}`);
    },
  });
}

export function useUpdateVariableCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VariableCost> & { id: string }) => {
      const { data, error } = await supabase
        .from('variable_costs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as VariableCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.variableCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo variável atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar custo variável: ${error.message}`);
    },
  });
}

export function useDeleteVariableCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('variable_costs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.variableCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Custo variável excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir custo variável: ${error.message}`);
    },
  });
}

// ==========================================
// API COSTS
// ==========================================
export function useApiCosts(filters?: { startDate?: string; endDate?: string; provider?: string }) {
  return useQuery({
    queryKey: financialKeys.apiCosts(filters),
    queryFn: async () => {
      let query = supabase
        .from('api_costs')
        .select('*')
        .order('date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters?.provider) {
        query = query.eq('provider', filters.provider);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ApiCost[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateApiCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cost: Omit<ApiCost, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('api_costs')
        .insert({ ...cost, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as ApiCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.apiCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Despesa de API registrada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar despesa de API: ${error.message}`);
    },
  });
}

export function useUpdateApiCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ApiCost> & { id: string }) => {
      const { data, error } = await supabase
        .from('api_costs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ApiCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.apiCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Despesa de API atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar despesa de API: ${error.message}`);
    },
  });
}

export function useDeleteApiCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_costs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.apiCosts() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Despesa de API excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir despesa de API: ${error.message}`);
    },
  });
}

// ==========================================
// REFUNDS
// ==========================================
export function useRefunds(filters?: { startDate?: string; endDate?: string; status?: string }) {
  return useQuery({
    queryKey: financialKeys.refunds(filters),
    queryFn: async () => {
      let query = supabase
        .from('refunds')
        .select('*, orders(*)')
        .order('refund_date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('refund_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('refund_date', filters.endDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (Refund & { orders?: any })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (refund: Omit<Refund, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('refunds')
        .insert({ ...refund, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Refund;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.refunds() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Reembolso criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar reembolso: ${error.message}`);
    },
  });
}

export function useUpdateRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Refund> & { id: string }) => {
      const { data, error } = await supabase
        .from('refunds')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Refund;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.refunds() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Reembolso atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar reembolso: ${error.message}`);
    },
  });
}

// ==========================================
// PIX SALES
// ==========================================
export function usePixSales(filters?: { startDate?: string; endDate?: string; status?: string }) {
  return useQuery({
    queryKey: financialKeys.pixSales(filters),
    queryFn: async () => {
      let query = supabase
        .from('pix_sales')
        .select('*, orders(*)')
        .order('sale_date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('sale_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('sale_date', filters.endDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (PixSale & { orders?: any })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePixSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sale: Omit<PixSale, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('pix_sales')
        .insert({ ...sale, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as PixSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.pixSales() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Venda PIX registrada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar venda PIX: ${error.message}`);
    },
  });
}

export function useUpdatePixSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PixSale> & { id: string }) => {
      const { data, error } = await supabase
        .from('pix_sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as PixSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.pixSales() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Venda PIX atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar venda PIX: ${error.message}`);
    },
  });
}

// ==========================================
// ADJUSTMENTS
// ==========================================
export function useAdjustments(filters?: { startDate?: string; endDate?: string; status?: string }) {
  return useQuery({
    queryKey: financialKeys.adjustments(filters),
    queryFn: async () => {
      let query = supabase
        .from('adjustments')
        .select('*, orders(*)')
        .order('adjustment_date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('adjustment_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('adjustment_date', filters.endDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (Adjustment & { orders?: any })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (adjustment: Omit<Adjustment, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('adjustments')
        .insert({ ...adjustment, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Adjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.adjustments() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Ajuste criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar ajuste: ${error.message}`);
    },
  });
}

export function useUpdateAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Adjustment> & { id: string }) => {
      const { data, error } = await supabase
        .from('adjustments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Adjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.adjustments() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Ajuste atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar ajuste: ${error.message}`);
    },
  });
}

// ==========================================
// PAID TRAFFIC
// ==========================================
export function usePaidTraffic(filters?: { startDate?: string; endDate?: string; platform?: string }) {
  return useQuery({
    queryKey: financialKeys.paidTraffic(filters),
    queryFn: async () => {
      let query = supabase
        .from('paid_traffic')
        .select('*')
        .order('date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PaidTraffic[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePaidTraffic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (traffic: Omit<PaidTraffic, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('paid_traffic')
        .insert({ ...traffic, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as PaidTraffic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.paidTraffic() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Tráfego pago registrado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar tráfego pago: ${error.message}`);
    },
  });
}

export function useUpdatePaidTraffic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaidTraffic> & { id: string }) => {
      const { data, error } = await supabase
        .from('paid_traffic')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as PaidTraffic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.paidTraffic() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Tráfego pago atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tráfego pago: ${error.message}`);
    },
  });
}

export function useDeletePaidTraffic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('paid_traffic')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.paidTraffic() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Tráfego pago excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tráfego pago: ${error.message}`);
    },
  });
}

// ==========================================
// CAKTO SALES
// ==========================================
export function useCaktoSales(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: financialKeys.caktoSales(filters),
    queryFn: async () => {
      let query = supabase
        .from('cakto_sales_summary')
        .select('*')
        .order('date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CaktoSalesSummary[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateCaktoSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sale: Omit<CaktoSalesSummary, 'id' | 'created_at' | 'updated_at' | 'total_sales_cents' | 'total_fees_cents' | 'net_revenue_cents' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('cakto_sales_summary')
        .insert({ ...sale, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as CaktoSalesSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.caktoSales() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Venda Cakto registrada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar venda Cakto: ${error.message}`);
    },
  });
}

export function useUpdateCaktoSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<CaktoSalesSummary, 'total_sales_cents' | 'total_fees_cents' | 'net_revenue_cents'>> & { id: string }) => {
      const { data, error } = await supabase
        .from('cakto_sales_summary')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CaktoSalesSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.caktoSales() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Venda Cakto atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar venda Cakto: ${error.message}`);
    },
  });
}

export function useDeleteCaktoSale() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cakto_sales_summary')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.caktoSales() });
      queryClient.invalidateQueries({ queryKey: financialKeys.dailySummary() });
      toast.success('Venda Cakto excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir venda Cakto: ${error.message}`);
    },
  });
}

// ==========================================
// DAILY SUMMARY
// ==========================================
export function useDailySummary(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: financialKeys.dailySummary(filters),
    queryFn: async () => {
      let query = supabase
        .from('daily_financial_summary')
        .select('*')
        .order('date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DailyFinancialSummary[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ==========================================
// SUMMARY STATS
// ==========================================
export function useFinancialSummary(period: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: [...financialKeys.dailySummary(), 'stats', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_financial_summary')
        .select('*')
        .gte('date', period.startDate)
        .lte('date', period.endDate)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const summaries = data as DailyFinancialSummary[];
      
      const totalRevenue = summaries.reduce((sum, s) => sum + s.revenue_cents, 0);
      const totalCosts = summaries.reduce((sum, s) => sum + s.costs_cents, 0);
      const totalProfit = summaries.reduce((sum, s) => sum + s.profit_cents, 0);
      const totalCakto = summaries.reduce((sum, s) => sum + s.cakto_sales_cents, 0);
      const totalPix = summaries.reduce((sum, s) => sum + s.pix_sales_cents, 0);
      const totalAdjustments = summaries.reduce((sum, s) => sum + s.adjustments_cents, 0);
      const totalRefunds = summaries.reduce((sum, s) => sum + s.refunds_cents, 0);
      const totalFixed = summaries.reduce((sum, s) => sum + s.fixed_costs_cents, 0);
      const totalVariable = summaries.reduce((sum, s) => sum + s.variable_costs_cents, 0);
      const totalApi = summaries.reduce((sum, s) => sum + s.api_costs_cents, 0);
      const totalTraffic = summaries.reduce((sum, s) => sum + s.traffic_costs_cents, 0);
      
      return {
        totalRevenue,
        totalCosts,
        totalProfit,
        totalCakto,
        totalPix,
        totalAdjustments,
        totalRefunds,
        totalFixed,
        totalVariable,
        totalApi,
        totalTraffic,
        margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        summaries,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

