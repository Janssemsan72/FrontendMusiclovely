import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Edit, DollarSign, Users, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useCollaboratorPermissions } from '@/hooks/useCollaboratorPermissions';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  commission_percentage: number;
  is_active: boolean;
  created_at: string;
}

interface Commission {
  id: string;
  order_id: string;
  commission_amount: number;
  status: string;
  created_at: string;
  paid_at?: string;
}

interface Withdrawal {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  status: string;
  requested_at: string;
  completed_at?: string;
  payment_method?: string;
  payment_reference?: string;
}

export default function AdminAffiliates() {
  const { userRole } = useCollaboratorPermissions();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [selectedTab, setSelectedTab] = useState('affiliates');
  
  // Form states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    commission_percentage: '10',
    is_active: true
  });

  const [withdrawalFormData, setWithdrawalFormData] = useState({
    payment_method: '',
    payment_reference: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedTab === 'affiliates') {
        const { data, error } = await supabase
          .from('affiliates')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAffiliates(data || []);
      } else if (selectedTab === 'commissions') {
        const { data, error } = await supabase
          .from('affiliate_commissions')
          .select('*, affiliates(name, email)')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setCommissions(data || []);
      } else if (selectedTab === 'withdrawals') {
        const { data, error } = await supabase
          .from('affiliate_withdrawals')
          .select('*, affiliates(name, email)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWithdrawals(data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAffiliate = async () => {
    try {
      if (!formData.password || formData.password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }

      // Criar afiliado
      const { data: affiliate, error: affiliateError } = await supabase
        .from('affiliates')
        .insert({
          name: formData.name,
          email: formData.email.toLowerCase().trim(),
          commission_percentage: parseFloat(formData.commission_percentage),
          is_active: formData.is_active
        })
        .select()
        .single();

      if (affiliateError) throw affiliateError;

      // Definir senha via Edge Function
      const { error: passwordError } = await supabase.functions.invoke('affiliate-auth', {
        body: {
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          action: 'set-password'
        }
      });

      if (passwordError) {
        // Se falhar ao definir senha, deletar o afiliado criado
        await supabase.from('affiliates').delete().eq('id', affiliate.id);
        throw passwordError;
      }

      // Criar link do afiliado (slug baseado no email ou nome)
      const slug = formData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Verificar se slug já existe e adicionar sufixo se necessário
      let finalSlug = slug;
      let counter = 1;
      while (true) {
        const { data: existing } = await supabase
          .from('affiliate_links')
          .select('id')
          .eq('slug', finalSlug)
          .single();

        if (!existing) break;
        finalSlug = `${slug}${counter}`;
        counter++;
      }

      const { error: linkError } = await supabase
        .from('affiliate_links')
        .insert({
          affiliate_id: affiliate.id,
          slug: finalSlug,
          is_active: true
        });

      if (linkError) throw linkError;

      toast.success('Afiliado criado com sucesso!');
      setShowCreateDialog(false);
      setFormData({ name: '', email: '', password: '', commission_percentage: '10', is_active: true });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar afiliado');
    }
  };

  const handleUpdateAffiliate = async () => {
    if (!selectedAffiliate) return;

    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          name: formData.name,
          commission_percentage: parseFloat(formData.commission_percentage),
          is_active: formData.is_active
        })
        .eq('id', selectedAffiliate.id);

      if (error) throw error;

      toast.success('Afiliado atualizado com sucesso!');
      setShowEditDialog(false);
      setSelectedAffiliate(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar afiliado');
    }
  };

  const handleProcessWithdrawal = async (action: 'processing' | 'complete' | 'cancel') => {
    if (!selectedWithdrawal) return;

    try {
      const { error } = await supabase.functions.invoke('process-withdrawal', {
        body: {
          withdrawal_id: selectedWithdrawal.id,
          action,
          ...(action === 'complete' && {
            payment_method: withdrawalFormData.payment_method,
            payment_reference: withdrawalFormData.payment_reference,
            notes: withdrawalFormData.notes
          }),
          ...(action === 'processing' && {
            payment_method: withdrawalFormData.payment_method,
            notes: withdrawalFormData.notes
          }),
          ...(action === 'cancel' && {
            notes: withdrawalFormData.notes
          })
        }
      });

      if (error) throw error;

      toast.success(`Saque ${action === 'complete' ? 'confirmado' : action === 'processing' ? 'em processamento' : 'cancelado'} com sucesso!`);
      setShowWithdrawalDialog(false);
      setSelectedWithdrawal(null);
      setWithdrawalFormData({ payment_method: '', payment_reference: '', notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar saque');
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && affiliates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Afiliados</h1>
          <p className="text-muted-foreground">Cadastre e gerencie afiliados, comissões e saques</p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Afiliado
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Afiliado</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do afiliado. Um link único será gerado automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do afiliado"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      A senha será usada pelo afiliado para fazer login
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="commission">Comissão (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.1"
                      value={formData.commission_percentage}
                      onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_active">Ativo</Label>
                  </div>
                  <Button onClick={handleCreateAffiliate} className="w-full">
                    Criar Afiliado
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Afiliados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>{affiliate.name}</TableCell>
                      <TableCell>{affiliate.email}</TableCell>
                      <TableCell>{affiliate.commission_percentage}%</TableCell>
                      <TableCell>
                        <Badge variant={affiliate.is_active ? 'default' : 'secondary'}>
                          {affiliate.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAffiliate(affiliate);
                            setFormData({
                              name: affiliate.name,
                              email: affiliate.email,
                              password: '', // Senha não é exibida ao editar (por segurança)
                              commission_percentage: affiliate.commission_percentage.toString(),
                              is_active: affiliate.is_active
                            });
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle>Comissões</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        {(commission as any).affiliates?.name || '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(commission.commission_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          commission.status === 'paid' ? 'default' :
                          commission.status === 'approved' ? 'secondary' :
                          'outline'
                        }>
                          {commission.status === 'paid' ? 'Pago' :
                           commission.status === 'approved' ? 'Aprovado' :
                           commission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(commission.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        {(withdrawal as any).affiliates?.name || '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(withdrawal.amount_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          withdrawal.status === 'completed' ? 'default' :
                          withdrawal.status === 'processing' ? 'secondary' :
                          withdrawal.status === 'pending' ? 'outline' :
                          'destructive'
                        }>
                          {withdrawal.status === 'completed' ? 'Concluído' :
                           withdrawal.status === 'processing' ? 'Processando' :
                           withdrawal.status === 'pending' ? 'Pendente' :
                           'Cancelado'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(withdrawal.requested_at)}</TableCell>
                      <TableCell>
                        {withdrawal.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setShowWithdrawalDialog(true);
                            }}
                          >
                            Processar
                          </Button>
                        )}
                        {withdrawal.status === 'processing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setWithdrawalFormData({
                                payment_method: withdrawal.payment_method || '',
                                payment_reference: withdrawal.payment_reference || '',
                                notes: ''
                              });
                              setShowWithdrawalDialog(true);
                            }}
                          >
                            Confirmar Pagamento
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-commission">Comissão (%)</Label>
              <Input
                id="edit-commission"
                type="number"
                step="0.1"
                value={formData.commission_percentage}
                onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-is_active">Ativo</Label>
            </div>
            <Button onClick={handleUpdateAffiliate} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Processing Dialog */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedWithdrawal?.status === 'pending' ? 'Processar Saque' : 'Confirmar Pagamento'}
            </DialogTitle>
            <DialogDescription>
              {selectedWithdrawal?.status === 'pending' 
                ? 'Marque o saque como em processamento e preencha os dados do pagamento.'
                : 'Confirme que o pagamento foi realizado e preencha os dados.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedWithdrawal && (
              <Alert>
                <AlertDescription>
                  Valor: {formatCurrency(selectedWithdrawal.amount_cents)}
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="payment_method">Método de Pagamento</Label>
              <Select
                value={withdrawalFormData.payment_method}
                onValueChange={(value) => setWithdrawalFormData({ ...withdrawalFormData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="DOC">DOC</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_reference">Referência/Comprovante</Label>
              <Input
                id="payment_reference"
                value={withdrawalFormData.payment_reference}
                onChange={(e) => setWithdrawalFormData({ ...withdrawalFormData, payment_reference: e.target.value })}
                placeholder="Número da transação, comprovante, etc."
              />
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={withdrawalFormData.notes}
                onChange={(e) => setWithdrawalFormData({ ...withdrawalFormData, notes: e.target.value })}
                placeholder="Observações (opcional)"
              />
            </div>
            <div className="flex gap-2">
              {selectedWithdrawal?.status === 'pending' && (
                <>
                  <Button
                    onClick={() => handleProcessWithdrawal('processing')}
                    className="flex-1"
                  >
                    Marcar como Processando
                  </Button>
                  <Button
                    onClick={() => handleProcessWithdrawal('complete')}
                    variant="default"
                    className="flex-1"
                  >
                    Confirmar Pagamento
                  </Button>
                </>
              )}
              {selectedWithdrawal?.status === 'processing' && (
                <Button
                  onClick={() => handleProcessWithdrawal('complete')}
                  className="w-full"
                >
                  Confirmar Pagamento
                </Button>
              )}
              <Button
                onClick={() => handleProcessWithdrawal('cancel')}
                variant="destructive"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

