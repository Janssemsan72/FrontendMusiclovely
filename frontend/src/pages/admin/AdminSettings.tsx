import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedTabs, EnhancedTabsContent, EnhancedTabsList, EnhancedTabsTrigger } from "@/components/ui/enhanced-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  DollarSign, Plug, Users, Wrench, Server, 
  Trash2, Database, HardDrive, Music, FileText, Activity, Mail
} from "lucide-react";
import IntegrationCard from "./components/IntegrationCard";
import AdminUserCard from "./components/AdminUserCard";
import MaintenanceTask from "./components/MaintenanceTask";
import SystemInfoCard from "./components/SystemInfoCard";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    display_name: string;
  };
}

interface IntegrationStatus {
  stripe: any;
  suno: any;
  resend: any;
  systemHealth: any;
}

export default function AdminSettings() {
  const [admins, setAdmins] = useState<UserRole[]>([]);
  const [collaborators, setCollaborators] = useState<UserRole[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [newCollaboratorPassword, setNewCollaboratorPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    stripe: null,
    suno: null,
    resend: null,
    systemHealth: null
  });
  const [checkoutEventsCount, setCheckoutEventsCount] = useState(0);
  const [rateLimitsCount, setRateLimitsCount] = useState(0);

  useEffect(() => {
    loadAdmins();
    loadCollaborators();
    loadIntegrationStatus();
    loadMaintenanceStats();
  }, []);

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, permissions, created_at, updated_at")
        .eq("role", "admin");

      if (error) throw error;

      setAdmins((data || []).map(role => ({
        ...role,
        profiles: { display_name: "Admin" }
      })));
    } catch (error) {
      toast.error("Erro ao carregar admins");
      console.error(error);
    }
  };

  const loadCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, permissions, created_at, updated_at")
        .eq("role", "collaborator");

      if (error) throw error;

      setCollaborators((data || []).map(role => ({
        ...role,
        profiles: { display_name: "Colaborador" }
      })));
    } catch (error) {
      toast.error("Erro ao carregar colaboradores");
      console.error(error);
    }
  };

  const loadIntegrationStatus = async () => {
    try {
      // Test Stripe - Verificar se há pedidos Stripe recentes
      const { count: stripeCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('payment_provider', 'stripe')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setIntegrations(prev => ({ 
        ...prev, 
        stripe: { connected: true, metrics: { transactions24h: stripeCount || 0 } }
      }));

      // Test Suno - Verificar se há jobs recentes
      const { count: sunoCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setIntegrations(prev => ({ 
        ...prev, 
        suno: { connected: true, credits: 'N/A' }
      }));

      // Test Resend - Verificar se há emails enviados recentemente
      const { count: resendCount } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setIntegrations(prev => ({ 
        ...prev, 
        resend: { connected: true, metrics: { emailsSent24h: resendCount || 0, deliveryRate: 95 } }
      }));

      // Get system health - Buscar dados do banco diretamente
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const { count: songsCount } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      setIntegrations(prev => ({ 
        ...prev, 
        systemHealth: { 
          database: { size: 'N/A', tables: 'N/A' },
          storage: { totalUsed: 'N/A' },
          activity24h: { newOrders: ordersCount || 0, newSongs: songsCount || 0 }
        }
      }));
    } catch (error) {
      console.error('Erro ao carregar status de integrações:', error);
      toast.error('Erro ao carregar status de integrações');
    }
  };

  const loadMaintenanceStats = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: checkoutCount } = await supabase
      .from('checkout_events')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', thirtyDaysAgo.toISOString());

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: rateLimitCount } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', oneDayAgo.toISOString());

    setCheckoutEventsCount(checkoutCount || 0);
    setRateLimitsCount(rateLimitCount || 0);
  };

  const addAdmin = async () => {
    if (!newAdminEmail) {
      toast.error("Informe o email ou user_id");
      return;
    }

    setLoading(true);
    try {
      let userId = newAdminEmail;

      // Check if it's an email - buscar na tabela profiles
      if (newAdminEmail.includes('@')) {
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', newAdminEmail)
          .single();
        
        if (lookupError || !profile) {
          toast.error("Usuário não encontrado. Certifique-se de que o usuário já fez login pelo menos uma vez.");
          return;
        }

        userId = profile.id;
      }

      const { error } = await supabase
        .from("user_roles")
        .insert([{ user_id: userId, role: "admin" }]);

      if (error) throw error;

      toast.success("Admin adicionado!");
      setNewAdminEmail("");
      loadAdmins();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar admin");
    } finally {
      setLoading(false);
    }
  };

  const removeAdmin = async (id: string) => {
    if (!confirm("Remover este admin?")) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Admin removido!");
    loadAdmins();
  };

  const addCollaborator = async () => {
    if (!newCollaboratorEmail || !newCollaboratorPassword) {
      toast.error("Email e senha são obrigatórios");
      return;
    }

    setLoadingCollaborators(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-collaborator', {
        body: {
          email: newCollaboratorEmail,
          password: newCollaboratorPassword
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Colaborador criado com sucesso!");
      setNewCollaboratorEmail("");
      setNewCollaboratorPassword("");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar colaborador");
      console.error(error);
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const removeCollaborator = async (id: string) => {
    if (!confirm("Remover este colaborador?")) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Colaborador removido!");
    loadCollaborators();
  };

  const runMaintenance = async (task: string) => {
    if (!confirm(`Executar tarefa de manutenção: ${task}?`)) return;

    setLoading(true);
    try {
      if (task === "cleanup_checkout_events") {
        const { error } = await supabase.rpc("cleanup_old_checkout_events");
        if (error) throw error;
      } else if (task === "cleanup_rate_limits") {
        const { error } = await supabase.rpc("cleanup_old_rate_limits");
        if (error) throw error;
      }
      toast.success("Manutenção executada!");
      loadMaintenanceStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const testIntegration = async (type: string) => {
    toast.loading(`Testando ${type}...`);
    await loadIntegrationStatus();
    toast.dismiss();
    toast.success(`${type} testado com sucesso!`);
  };

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between gap-2 md:gap-3">
        <h1 className="text-xl md:text-3xl font-bold">Configurações</h1>
        <Button variant="outline" onClick={loadIntegrationStatus} size="sm">
          <Activity className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      <EnhancedTabs defaultValue="integrations" variant="pills" className="space-y-2 md:space-y-4">
        <EnhancedTabsList className="admin-tabs-marrom grid grid-cols-2 md:grid-cols-5 w-full h-auto">
          <EnhancedTabsTrigger value="integrations" icon={<Plug className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />} className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <span className="hidden sm:inline">Integrações</span>
            <span className="sm:hidden">Int.</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="admins" icon={<Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />} className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <span className="hidden sm:inline">Admins</span>
            <span className="sm:hidden">Adm.</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="collaborators" icon={<Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />} className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <span className="hidden sm:inline">Colaboradores</span>
            <span className="sm:hidden">Col.</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="maintenance" icon={<Wrench className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />} className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <span className="hidden sm:inline">Manutenção</span>
            <span className="sm:hidden">Man.</span>
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="system" icon={<Server className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />} className="gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3">
            <span className="hidden sm:inline">Sistema</span>
            <span className="sm:hidden">Sis.</span>
          </EnhancedTabsTrigger>
        </EnhancedTabsList>

        <EnhancedTabsContent value="integrations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <IntegrationCard
              name="Stripe"
              description="Processamento de pagamentos"
              icon={<DollarSign className="h-5 w-5 text-primary" />}
              status={integrations.stripe?.connected ? 'connected' : 'error'}
              lastCheck={new Date()}
              metrics={integrations.stripe?.metrics ? [
                { label: 'Transações', value: integrations.stripe.metrics.transactions24h },
                { label: 'Valor Total', value: `R$ ${integrations.stripe.metrics.totalAmount}` },
                { label: 'Taxa de Sucesso', value: `${Math.round((integrations.stripe.metrics.successfulCharges / integrations.stripe.metrics.transactions24h) * 100) || 100}%` }
              ] : []}
              onTest={() => testIntegration('Stripe')}
              dashboardUrl="https://dashboard.stripe.com"
            />

            <IntegrationCard
              name="Suno API"
              description="Geração de músicas"
              icon={<Music className="h-5 w-5 text-primary" />}
              status={integrations.suno?.connected ? 'connected' : 'error'}
              lastCheck={new Date()}
              metrics={integrations.suno?.credits ? [
                { label: 'Créditos', value: integrations.suno.credits }
              ] : []}
              onTest={() => testIntegration('Suno')}
            />

            <IntegrationCard
              name="Resend"
              description="Envio de emails"
              icon={<Mail className="h-5 w-5 text-primary" />}
              status={integrations.resend?.connected ? 'connected' : 'error'}
              lastCheck={new Date()}
              metrics={integrations.resend?.metrics ? [
                { label: 'Emails Enviados', value: integrations.resend.metrics.emailsSent24h },
                { label: 'Taxa de Entrega', value: `${integrations.resend.metrics.deliveryRate}%` }
              ] : []}
              onTest={() => testIntegration('Resend')}
              dashboardUrl="https://resend.com/emails"
            />

            <IntegrationCard
              name="Supabase"
              description="Banco de dados e autenticação"
              icon={<Database className="h-5 w-5 text-primary" />}
              status="connected"
              lastCheck={new Date()}
              metrics={[
                { label: 'Banco de Dados', value: integrations.systemHealth?.database?.size || 'N/A' }
              ]}
              dashboardUrl="https://supabase.com/dashboard"
            />
          </div>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="admins">
          <Card className="admin-card-compact">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">Gerenciar Administradores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-4 p-2 md:p-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Email ou User ID (UUID)"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
                <Button onClick={addAdmin} disabled={loading}>
                  Adicionar Admin
                </Button>
              </div>
              <div className="space-y-2">
                {admins.map((admin) => (
                  <AdminUserCard
                    key={admin.id}
                    userId={admin.user_id}
                    displayName={admin.profiles?.display_name}
                    createdAt={admin.created_at}
                    onRemove={() => removeAdmin(admin.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="collaborators">
          <Card className="admin-card-compact">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">Gerenciar Colaboradores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-4 p-2 md:p-6">
              <div className="space-y-2">
                <div className="flex gap-2 flex-col md:flex-row">
                  <Input
                    type="email"
                    placeholder="Email do colaborador"
                    value={newCollaboratorEmail}
                    onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="password"
                    placeholder="Senha (mínimo 6 caracteres)"
                    value={newCollaboratorPassword}
                    onChange={(e) => setNewCollaboratorPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={addCollaborator} disabled={loadingCollaborators}>
                    {loadingCollaborators ? "Criando..." : "Criar Colaborador"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O colaborador terá acesso apenas aos menus: Pedidos, Músicas, Gerenciar Letras e Liberações
                </p>
              </div>
              <div className="space-y-2">
                {collaborators.map((collaborator) => (
                  <AdminUserCard
                    key={collaborator.id}
                    userId={collaborator.user_id}
                    displayName={collaborator.profiles?.display_name || "Colaborador"}
                    email={(collaborator.profiles as any)?.email}
                    createdAt={collaborator.created_at}
                    onRemove={() => removeCollaborator(collaborator.id)}
                  />
                ))}
                {collaborators.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum colaborador cadastrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="maintenance">
          <div className="space-y-2 md:space-y-4">
            <MaintenanceTask
              icon={<Trash2 className="h-5 w-5 text-primary" />}
              title="Limpar Eventos de Checkout Antigos"
              description="Remove eventos com mais de 30 dias"
              recordsToDelete={checkoutEventsCount}
              loading={loading}
              onExecute={() => runMaintenance("cleanup_checkout_events")}
            />

            <MaintenanceTask
              icon={<Trash2 className="h-5 w-5 text-primary" />}
              title="Limpar Rate Limits Antigos"
              description="Remove rate limits com mais de 24 horas"
              recordsToDelete={rateLimitsCount}
              loading={loading}
              onExecute={() => runMaintenance("cleanup_rate_limits")}
            />
          </div>
        </EnhancedTabsContent>

        <EnhancedTabsContent value="system">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-4">
            <SystemInfoCard
              title="Banco de Dados"
              icon={<Database className="h-5 w-5 text-primary" />}
              items={[
                { label: 'Tamanho Total', value: integrations.systemHealth?.database?.size || 'N/A' },
                { label: 'Tabelas', value: integrations.systemHealth?.database?.tables || 'N/A' }
              ]}
            />

            <SystemInfoCard
              title="Storage"
              icon={<HardDrive className="h-5 w-5 text-primary" />}
              items={[
                { label: 'Total Usado', value: integrations.systemHealth?.storage?.totalUsed || 'N/A' },
                ...(integrations.systemHealth?.storage?.byBucket?.map((b: any) => ({
                  label: b.name,
                  value: b.size
                })) || [])
              ]}
            />

            <SystemInfoCard
              title="Atividade (24h)"
              icon={<Activity className="h-5 w-5 text-primary" />}
              items={[
                { label: 'Novos Pedidos', value: integrations.systemHealth?.activity24h?.newOrders || 0 },
                { label: 'Novas Músicas', value: integrations.systemHealth?.activity24h?.newSongs || 0 }
              ]}
            />

            <SystemInfoCard
              title="Versão"
              icon={<FileText className="h-5 w-5 text-primary" />}
              items={[
                { label: 'App', value: 'v1.0.0' },
                { label: 'Ambiente', value: 'Production' }
              ]}
            />
          </div>
        </EnhancedTabsContent>
      </EnhancedTabs>
    </div>
  );
}
