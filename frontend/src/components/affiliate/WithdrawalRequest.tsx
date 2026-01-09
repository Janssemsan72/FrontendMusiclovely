import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawalRequestProps {
  affiliateId: string;
  availableBalance: number; // em centavos
  onWithdrawalRequested: () => void;
}

export default function WithdrawalRequest({ 
  affiliateId, 
  availableBalance,
  onWithdrawalRequested 
}: WithdrawalRequestProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const MIN_WITHDRAWAL = 5000; // R$ 50,00 em centavos
  const maxAmount = availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amountCents = Math.round(parseFloat(amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Valor inválido');
      setLoading(false);
      return;
    }

    if (amountCents < MIN_WITHDRAWAL) {
      setError(`Valor mínimo para saque é R$ ${MIN_WITHDRAWAL / 100},00`);
      setLoading(false);
      return;
    }

    if (amountCents > maxAmount) {
      setError(`Saldo insuficiente. Disponível: R$ ${(maxAmount / 100).toFixed(2)}`);
      setLoading(false);
      return;
    }

    try {
      const { data, error: requestError } = await supabase.functions.invoke('request-withdrawal', {
        body: {
          affiliate_id: affiliateId,
          amount_cents: amountCents
        }
      });

      if (requestError || !data?.success) {
        throw new Error(data?.error || requestError?.message || 'Erro ao solicitar saque');
      }

      toast.success('Solicitação de saque enviada com sucesso!');
      setAmount('');
      onWithdrawalRequested();
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar saque');
      toast.error(err.message || 'Erro ao solicitar saque');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitar Saque</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Valor (R$)
            </label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={MIN_WITHDRAWAL / 100}
              max={maxAmount / 100}
              placeholder="50.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={loading || maxAmount < MIN_WITHDRAWAL}
            />
            <p className="text-xs text-muted-foreground">
              Valor mínimo: R$ {MIN_WITHDRAWAL / 100},00 | 
              Disponível: R$ {(maxAmount / 100).toFixed(2)}
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || maxAmount < MIN_WITHDRAWAL}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Solicitar Saque'
            )}
          </Button>

          {maxAmount < MIN_WITHDRAWAL && (
            <Alert>
              <AlertDescription>
                Saldo insuficiente. Valor mínimo para saque é R$ {MIN_WITHDRAWAL / 100},00
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

