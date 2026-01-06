import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function AffiliateLogin() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Buscar afiliado por email
      const { data: affiliate, error: affiliateError } = await supabase
        .from('affiliates')
        .select('id, email, name, is_active')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .single();

      if (affiliateError || !affiliate) {
        setError('Email não encontrado ou afiliado inativo');
        setLoading(false);
        return;
      }

      // Por enquanto, usar email como token simples
      // Em produção, você pode implementar um sistema de tokens mais seguro
      // Salvar no sessionStorage
      sessionStorage.setItem('affiliate_id', affiliate.id);
      sessionStorage.setItem('affiliate_email', affiliate.email);
      sessionStorage.setItem('affiliate_name', affiliate.name || '');

      navigate('/afiliado');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Área do Afiliado</CardTitle>
          <CardDescription className="text-center">
            Faça login para acessar seu dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Token de Acesso (opcional)
              </label>
              <Input
                id="token"
                type="password"
                placeholder="Token de acesso"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

