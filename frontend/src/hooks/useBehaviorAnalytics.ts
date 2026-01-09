import { useState, useEffect, useCallback } from 'react';

export interface AnalyticsLinks {
  dashboard: string;
  heatmaps: string;
  recordings: string;
  insights?: string;
  errors?: string;
  funnels?: string;
  feedback?: string;
}

interface BehaviorAnalyticsData {
  clarity: null;
  hotjar: null;
}

export function useBehaviorAnalytics() {
  const [data, setData] = useState<BehaviorAnalyticsData>({
    clarity: null,
    hotjar: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Analytics removidos - Clarity e Hotjar não estão mais disponíveis
      setData({
        clarity: null,
        hotjar: null,
      });
    } catch (err: any) {
      console.error('Erro ao buscar analytics:', err);
      setError(err.message || 'Erro ao buscar dados de analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics().catch((error) => {
      console.error('❌ [useBehaviorAnalytics] Erro não tratado em fetchAnalytics:', error);
      setError(error?.message || 'Erro ao buscar dados de analytics');
    });
  }, [fetchAnalytics]);

  // Calcular métricas do funil de conversão
  const calculateFunnelMetrics = useCallback(() => {
    // Sem dados disponíveis após remoção do Clarity e Hotjar
    return null;
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
    funnelMetrics: calculateFunnelMetrics(),
  };
}

