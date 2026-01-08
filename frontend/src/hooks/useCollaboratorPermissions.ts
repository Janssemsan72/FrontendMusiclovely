import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ensureE2EAdminStorageAuthorized, navigateToAdminAuthPreservingSearch } from '@/utils/adminE2EBypass';

type PermissionRow = { permission_key: string; granted: boolean | null };

// Valores padrão para colaboradores
const defaultCollaboratorPermissions: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  songs: true,
  lyrics: true,
  releases: true,
  generate: false,
  collaborators: false,
  emails: false,
  email_logs: false,
  whatsapp_templates: false,
  media: false,
  example_tracks: false,
  logs: false,
  settings: false,
};

export function useCollaboratorPermissions(requiredPermission?: string) {
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'collaborator' | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      setIsLoading(true);

      const ensureE2EAdminAuthorized = () => {
        if (!ensureE2EAdminStorageAuthorized()) return false;
        setUserRole('admin');
        setHasPermission(true);
        setIsLoading(false);
        return true;
      };

      const navigateToAdminAuth = () => {
        if (ensureE2EAdminAuthorized()) return true;
        navigateToAdminAuthPreservingSearch(navigate);
        return false;
      };
      
      try {
        // ✅ OTIMIZAÇÃO: Verificar cache do localStorage PRIMEIRO (antes de verificar sessão)
        // Isso evita redirecionamentos prematuros quando a sessão ainda está sendo estabelecida
        const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
        const isDev = import.meta.env.DEV;

        if (ensureE2EAdminAuthorized()) return;
        
        if (isDev) {
          console.log('🔍 [useCollaboratorPermissions] Cache encontrado:', cachedRole, 'RequiredPermission:', requiredPermission);
        }
        
        // Se temos cache válido e não precisa verificar permissões específicas, usar cache imediatamente
        if (cachedRole && !requiredPermission) {
          if (isDev) {
            console.log('✅ [useCollaboratorPermissions] Usando cache, permitindo acesso imediatamente');
          }
          setUserRole(cachedRole);
          setHasPermission(true);
          setIsLoading(false);
          
          // Verificar sessão em background (não bloquear UI)
          // Aguardar um pouco antes de verificar para dar tempo da sessão ser estabelecida
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
              if (sessionError || !session?.user) {
                if (isDev) {
                  console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada em background check, mas cache existe. Aguardando...');
                }
                // Não redirecionar imediatamente - pode ser que a sessão ainda esteja sendo estabelecida
                // O AdminLayout vai verificar novamente se necessário
              }
            });
          }, 500);
          return;
        }
        
        // ✅ OTIMIZAÇÃO: Usar getSession() que é mais rápido (usa cache)
        // Aguardar um pouco para garantir que a sessão está estabelecida após login
        await new Promise(resolve => setTimeout(resolve, 200));
        
        let session: any = null;
        let user: any = null;
        
        const firstAttempt = await supabase.auth.getSession();
        session = firstAttempt.data.session;
        
        if (firstAttempt.error || !session?.user) {
          // Se não houver sessão, verificar novamente após mais um delay
          // (pode ser que a sessão ainda esteja sendo estabelecida)
          if (isDev) {
            console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada na primeira tentativa, tentando novamente...');
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          const retryAttempt = await supabase.auth.getSession();
          
          if (retryAttempt.error || !retryAttempt.data.session?.user) {
            if (isDev) {
              console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada após retry');
            }
            // Só limpar cache e redirecionar se realmente não houver sessão após retry
            if (ensureE2EAdminAuthorized()) return;
            localStorage.removeItem('user_role');
            navigateToAdminAuth();
            return;
          }
          // Se retry funcionou, usar a sessão retry
          session = retryAttempt.data.session;
          user = session.user;
          if (isDev) {
            console.log('✅ [useCollaboratorPermissions] Sessão encontrada após retry');
          }
        } else {
          user = session.user;
        }
        
        if (!user) {
          if (isDev) {
            console.error('❌ [useCollaboratorPermissions] Não foi possível obter usuário da sessão');
          }
          if (ensureE2EAdminAuthorized()) return;
          localStorage.removeItem('user_role');
          navigateToAdminAuth();
          return;
        }

        // Buscar role do banco (apenas se não tiver cache ou precisar verificar permissão)
        if (isDev) {
          console.log('🔍 [useCollaboratorPermissions] Buscando role do banco para user_id:', user.id);
        }
        
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (isDev) {
          console.log('📊 [useCollaboratorPermissions] Role data:', roleData, 'Error:', roleError);
        }

        // Verificar cache novamente (pode ter sido definido no início)
        const currentCache = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
        
        if (roleError) {
          if (isDev) {
            console.error('❌ [useCollaboratorPermissions] Erro ao buscar role:', roleError);
          }
          // Se houver erro mas tiver cache, usar cache
          if (currentCache) {
            if (isDev) {
              console.log('⚠️ [useCollaboratorPermissions] Erro ao buscar role, mas usando cache:', currentCache);
            }
            setUserRole(currentCache);
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          navigateToAdminAuth();
          return;
        }

        if (!roleData) {
          if (isDev) {
            console.warn('⚠️ [useCollaboratorPermissions] Nenhuma role encontrada no banco');
          }
          // Se não houver role mas tiver cache, usar cache
          if (currentCache) {
            if (isDev) {
              console.log('⚠️ [useCollaboratorPermissions] Nenhuma role no banco, mas usando cache:', currentCache);
            }
            setUserRole(currentCache);
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          navigateToAdminAuth();
          return;
        }

        const roleValue = roleData.role === 'admin' ? 'admin' : 'collaborator';
        setUserRole(roleValue);
        
        // ✅ OTIMIZAÇÃO: Atualizar cache
        localStorage.setItem('user_role', roleValue);

        // Se for admin, tem todas as permissões
        if (roleValue === 'admin') {
          setHasPermission(true);
          setIsLoading(false);
          return;
        }

        // Se for colaborador e não há permissão requerida, permitir
        if (!requiredPermission) {
          setHasPermission(true);
          setIsLoading(false);
          return;
        }

        // Buscar permissões do colaborador
        const { data: permissionsData } = await supabase
          .from('collaborator_permissions')
          .select('permission_key, granted')
          .eq('user_id', user.id);

        const permissionsMap: Record<string, boolean> = { ...defaultCollaboratorPermissions };
        
        if (permissionsData) {
          (permissionsData as PermissionRow[]).forEach((perm) => {
            permissionsMap[perm.permission_key] = perm.granted;
          });
        }

        // Verificar se tem a permissão requerida
        const hasRequiredPermission = permissionsMap[requiredPermission] ?? defaultCollaboratorPermissions[requiredPermission] ?? false;
        
        if (!hasRequiredPermission) {
          toast.error('Você não tem permissão para acessar esta página');
          
          // Redirecionar para a primeira página que o colaborador tem acesso
          // Evitar redirecionar para /admin se não tiver permissão de dashboard (evita loop)
          const allowedRoutes = [
            { key: 'orders', path: '/admin/orders' },
            { key: 'songs', path: '/admin/songs' },
            { key: 'lyrics', path: '/admin/lyrics' },
            { key: 'releases', path: '/admin/releases' },
          ];
          
          const firstAllowedRoute = allowedRoutes.find(route => permissionsMap[route.key]);
          if (firstAllowedRoute) {
            navigate(firstAllowedRoute.path);
          } else {
            // Se não tem nenhuma permissão, redirecionar para auth
            navigateToAdminAuth();
          }
          
          setHasPermission(false);
        } else {
          setHasPermission(true);
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        navigateToAdminAuth();
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredPermission]); // Remover navigate das dependências (função estável)

  return { hasPermission, isLoading, userRole };
}
