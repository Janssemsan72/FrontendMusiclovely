import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import StatsCards from '@/components/affiliate/StatsCards';
import AffiliateLink from '@/components/affiliate/AffiliateLink';
import WithdrawalRequest from '@/components/affiliate/WithdrawalRequest';
import WithdrawalHistory from '@/components/affiliate/WithdrawalHistory';
import SalesTable from '@/components/affiliate/SalesTable';

interface AffiliateStats {
  affiliate: {
    id: string;
    name: string;
    email: string;
    commission_percentage: number;
    link: {
      slug: string;
      url: string;
    } | null;
  };
  stats: {
    total_sales: number;
    total_earned_cents: number;
    total_paid_cents: number;
    total_withdrawn_cents: number;
    pending_withdrawal_cents: number;
    available_balance_cents: number;
  };
  recent_sales: any[];
  withdrawal_history: any[];
}

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const affiliateId = sessionStorage.getItem('affiliate_id');
  const affiliateName = sessionStorage.getItem('affiliate_name') || 'Afiliado';

  useEffect(() => {
    if (!affiliateId) {
      navigate('/afiliado/login');
      return;
    }

    loadStats();
  }, [affiliateId, navigate]);

  const loadStats = async () => {
    if (!affiliateId) return;

    try {
      setRefreshing(true);
      const { data, error } = await supabase.functions.invoke('get-affiliate-stats', {
        body: { affiliate_id: affiliateId }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao carregar estatísticas');
      }

      setStats(data);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('affiliate_id');
    sessionStorage.removeItem('affiliate_email');
    sessionStorage.removeItem('affiliate_name');
    navigate('/afiliado/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Erro ao carregar dados do afiliado
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard do Afiliado</h1>
            <p className="text-muted-foreground">Bem-vindo, {affiliateName}!</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Stats Cards */}
        <StatsCards
          totalSales={stats.stats.total_sales}
          totalEarned={stats.stats.total_earned_cents}
          availableBalance={stats.stats.available_balance_cents}
          pendingWithdrawals={stats.stats.pending_withdrawal_cents}
        />

        {/* Affiliate Link */}
        {stats.affiliate.link && (
          <AffiliateLink
            slug={stats.affiliate.link.slug}
            url={stats.affiliate.link.url}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Withdrawal Request */}
          <WithdrawalRequest
            affiliateId={stats.affiliate.id}
            availableBalance={stats.stats.available_balance_cents}
            onWithdrawalRequested={loadStats}
          />

          {/* Withdrawal History */}
          <WithdrawalHistory withdrawals={stats.withdrawal_history} />
        </div>

        {/* Sales Table */}
        <SalesTable sales={stats.recent_sales} />

        {/* Refresh Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadStats}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              'Atualizar Dados'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

