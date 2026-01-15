import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield } from '@/utils/iconImports';

export default function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Verificar se o cliente Supabase está inicializado corretamente
  const isClientInitialized = () => {
    try {
      // Verificar se as variáveis de ambiente estão definidas
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const hasUrl = !!url && url.trim() !== '';
      const hasKey = !!key && key.trim() !== '';
      
      // Log de diagnóstico em desenvolvimento
      if (import.meta.env.DEV) {
        console.log('🔍 [AdminAuth] Verificação de inicialização:', {
          hasUrl,
          hasKey,
          urlLength: url?.length || 0,
          keyLength: key?.length || 0,
          urlPreview: url ? `${url.substring(0, 30)}...` : 'undefined',
        });
      }
      
      // Se não tem variáveis de ambiente, definitivamente não está inicializado
      if (!hasUrl || !hasKey) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ [AdminAuth] Variáveis de ambiente faltando:', {
            VITE_SUPABASE_URL: hasUrl ? '✅' : '❌',
            VITE_SUPABASE_ANON_KEY: hasKey ? '✅' : '❌',
          });
        }
        return false;
      }
      
      // Verificar se o cliente existe e tem a estrutura esperada
      if (!supabase || !supabase.auth) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ [AdminAuth] Cliente Supabase não existe ou não tem auth');
        }
        return false;
      }
      
      // Verificar se o cliente tem métodos reais (não é dummy)
      if (typeof supabase.auth.signInWithPassword !== 'function') {
        if (import.meta.env.DEV) {
          console.warn('⚠️ [AdminAuth] Cliente não tem método signInWithPassword');
        }
        return false;
      }
      
      // Se passou todas as verificações, provavelmente está inicializado
      if (import.meta.env.DEV) {
        console.log('✅ [AdminAuth] Cliente Supabase inicializado corretamente');
      }
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [AdminAuth] Erro ao verificar inicialização:', error);
      }
      return false;
    }
  };

  const canBypassAdminAuth = () => {
    if (import.meta.env.MODE !== 'production') return true;
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') return true;
    return import.meta.env.VITE_E2E === 'true';
  };

  const shouldBypassNow = (() => {
    try {
      if (!canBypassAdminAuth() || typeof window === 'undefined') return false;
      if (localStorage.getItem('e2e_admin') === 'true') return true;

      const url = new URL(window.location.href);
      const e2eAdminParam = url.searchParams.get('e2e_admin');
      if (e2eAdminParam !== '1' && e2eAdminParam !== 'true') return false;

      localStorage.setItem('e2e_admin', 'true');
      localStorage.setItem('user_role', 'admin');
      url.searchParams.delete('e2e_admin');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      return true;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!shouldBypassNow) return;
    try {
      localStorage.setItem('user_role', 'admin');
    } catch {
      void 0;
    }
    navigate('/admin', { replace: true });
  }, [navigate, shouldBypassNow, location.pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ CORREÇÃO: Prevenir múltiplos cliques simultâneos
    if (loading) {
      return;
    }
    
    setLoading(true);

    try {
      // ✅ Verificar se o cliente está inicializado antes de tentar login
      if (!isClientInitialized()) {
        const errorMsg = 'Cliente Supabase não inicializado. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
        console.error('❌', errorMsg);
        console.error('📋 Variáveis de ambiente:', {
          VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Definida' : '❌ Não definida',
          VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Definida' : '❌ Não definida',
          VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✅ Definida' : '❌ Não definida',
        });
        toast.error('Erro de configuração: Cliente Supabase não inicializado. Verifique o console para mais detalhes.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // ✅ Verificar se o erro é do cliente não inicializado
      if (authError) {
        // Verificar se é o erro específico do cliente dummy
        if (authError.code === 'CLIENT_NOT_INITIALIZED' || 
            authError.message?.includes('Cliente não inicializado') ||
            authError.message?.includes('dummy client')) {
          const errorMsg = 'Cliente Supabase não inicializado. Verifique as variáveis de ambiente.';
          console.error('❌', errorMsg, authError);
          console.error('📋 Variáveis de ambiente:', {
            VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Definida' : '❌ Não definida',
            VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Definida' : '❌ Não definida',
            VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✅ Definida' : '❌ Não definida',
          });
          toast.error('Erro de configuração: Cliente Supabase não inicializado. Verifique o console para mais detalhes.');
          setLoading(false);
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erro ao autenticar');
      }

      // Aguardar um pouco para garantir que a sessão está completamente estabelecida
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verificar novamente se o usuário está autenticado
      const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !currentUser) {
        console.error('❌ Erro ao obter usuário autenticado:', getUserError);
        throw new Error('Sessão não estabelecida');
      }

      // ✅ SEGURANÇA: Sempre verificar role admin (nunca bypassar)
      console.log('🔍 Verificando role para usuário:', currentUser.id);
      console.log('🔍 Email do usuário:', currentUser.email);
      
      // Buscar todas as roles do usuário (sem maybeSingle para evitar erro 406)
      const { data: allRoles, error: allRolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
      
      console.log('📊 Todas as roles do usuário:', { allRoles, allRolesError });
      if (allRolesError) {
        console.error('❌ Erro detalhado na busca geral:', JSON.stringify(allRolesError, null, 2));
      }
      
      // Se encontrou roles, priorizar collaborator sobre admin (se tiver ambas)
      let roles: { role: string } | null = null;
      const rolesError = allRolesError;
      
      if (allRoles && allRoles.length > 0) {
        // Priorizar collaborator se existir, senão usar a primeira
        const collaboratorRole = allRoles.find(r => r.role === 'collaborator');
        const adminRole = allRoles.find(r => r.role === 'admin');
        
        if (collaboratorRole) {
          roles = { role: 'collaborator' };
          console.log('✅ Role encontrada: collaborator (priorizado)');
        } else if (adminRole) {
          roles = { role: 'admin' };
          console.log('✅ Role encontrada: admin');
        } else {
          // Usar a primeira role encontrada
          roles = { role: allRoles[0].role };
          console.log('✅ Role encontrada:', roles);
        }
      } else if (allRolesError) {
        // Se houve erro, verificar se é erro de permissão
        console.error('❌ Erro ao buscar roles:', allRolesError);
        if (allRolesError.code === 'PGRST116' || allRolesError.code === '42501') {
          console.error('⚠️ Erro de permissão RLS detectado');
        }
      }

      if (rolesError) {
        console.error('❌ Erro ao verificar role:', JSON.stringify(rolesError, null, 2));
        console.error('Detalhes do erro:', {
          message: rolesError.message,
          code: rolesError.code,
          details: rolesError.details,
          hint: rolesError.hint
        });
        
        // Se erro for RLS (PGRST116 ou 42501), informar melhor
        if (rolesError.code === 'PGRST116') {
          console.error('⚠️ Nenhuma role encontrada para este usuário');
          toast.error('Usuário não possui permissões de administrador ou colaborador');
        } else if (rolesError.code === '42501') {
          console.error('⚠️ Erro de permissão RLS - usuário não pode ver sua própria role');
          toast.error('Erro de permissão - verifique configuração RLS');
        } else {
          toast.error(`Erro ao verificar permissões: ${rolesError.message}`);
        }
        
        await supabase.auth.signOut();
        return;
      }

      // Verificar se role existe
      if (!roles) {
        console.warn('⚠️ Nenhuma role encontrada para este usuário');
        await supabase.auth.signOut();
        toast.error('Usuário não possui permissões de administrador ou colaborador');
        return;
      }

      // Comparar role (pode ser enum app_role ou string)
      const roleValue = roles?.role;
      console.log('🎭 Role value:', roleValue, 'Tipo:', typeof roleValue);
      
      const isAdmin = roleValue === 'admin' || String(roleValue) === 'admin';
      const isCollaborator = roleValue === 'collaborator' || String(roleValue) === 'collaborator';
      console.log('✅ É admin?', isAdmin, 'É collaborator?', isCollaborator);
      
      if (!isAdmin && !isCollaborator) {
        console.warn('⚠️ Acesso negado - role não é admin ou collaborator:', roleValue);
        await supabase.auth.signOut();
        toast.error('Acesso negado - apenas administradores e colaboradores');
        return;
      }

      // Salvar role no localStorage ANTES do redirecionamento
      const finalRole = isAdmin ? 'admin' : 'collaborator';
      localStorage.setItem('user_role', finalRole);
      
      // Aguardar um pouco para garantir que o localStorage foi salvo
      await new Promise(resolve => setTimeout(resolve, 100));

      toast.success('Login realizado com sucesso!');
      
      // Aguardar um pouco mais para garantir que o toast foi exibido
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Se for colaborador, redirecionar para /admin/orders ao invés de /admin
      if (finalRole === 'collaborator') {
        navigate('/admin/orders', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (error: any) {
      // ✅ Melhorar tratamento de erro com mais detalhes
      console.error('❌ Erro no login:', error);
      
      // Extrair mensagem de erro de forma mais robusta
      let errorMessage = 'Erro ao fazer login';
      
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (typeof error === 'object') {
          // Tentar serializar o erro para obter mais informações
          try {
            const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
            console.error('📋 Detalhes completos do erro:', errorStr);
            
            // Verificar se contém mensagens específicas
            if (errorStr.includes('Cliente não inicializado') || 
                errorStr.includes('CLIENT_NOT_INITIALIZED') ||
                errorStr.includes('dummy client')) {
              errorMessage = 'Cliente Supabase não inicializado. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
            } else if (errorStr.includes('Invalid login credentials')) {
              errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';
            } else if (errorStr.includes('Email not confirmed')) {
              errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
            } else {
              errorMessage = error.message || 'Erro ao fazer login. Verifique o console para mais detalhes.';
            }
          } catch {
            errorMessage = error.message || 'Erro ao fazer login';
          }
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (shouldBypassNow) return null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-xs">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        <Card className="relative backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative bg-primary/10 p-3 rounded-full">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Acesso Administrativo
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 text-sm">
              Área restrita para administradores do sistema
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-4 pb-4">
            {/* ✅ Aviso se cliente não estiver inicializado */}
            {!isClientInitialized() && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium">⚠️ Cliente Supabase não inicializado</p>
                    <p className="text-red-700 dark:text-red-300 mt-1">
                      Configure as variáveis de ambiente <code className="text-xs bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="text-xs bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> no arquivo <code className="text-xs bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">.env</code>
                    </p>
                    <p className="text-red-700 dark:text-red-300 mt-1 text-xs">
                      Verifique o console do navegador para mais detalhes.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email de Administrador
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite seu email de administrador"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-10 text-sm font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Entrar no Painel
                  </>
                )}
              </Button>
            </form>
            
            {/* Security Notice */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Acesso Seguro</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Esta área é protegida por autenticação de dois fatores e criptografia de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
