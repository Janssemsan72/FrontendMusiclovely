import { useEffect, useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { ensureE2EAdminStorageAuthorized, navigateToAdminAuthPreservingSearch } from '@/utils/adminE2EBypass';

const AdminDashboard = lazyWithRetry(() => import('@/pages/AdminDashboard'));

/**
 * Componente que redireciona colaboradores sem permissão de dashboard
 * para /admin/orders, ou renderiza o AdminDashboard se tiver permissão
 */
export default function AdminDashboardRedirect() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRenderDashboard, setShouldRenderDashboard] = useState(false);

  useEffect(() => {
    const checkAndRedirect = async () => {
      const navigateToAdminAuth = () => {
        navigateToAdminAuthPreservingSearch(navigate);
      };

      try {
        if (ensureE2EAdminStorageAuthorized()) {
          setShouldRenderDashboard(true);
          setIsLoading(false);
          return;
        }

        // ✅ OTIMIZAÇÃO: Verificar localStorage primeiro (mais rápido)
        const cachedRole = localStorage.getItem('user_role');
        if (cachedRole === 'admin') {
          // Se já sabemos que é admin, renderizar imediatamente
          setShouldRenderDashboard(true);
          setIsLoading(false);
          return;
        }

        if (cachedRole === 'collaborator') {
          const cachedPermissionsRaw = localStorage.getItem('user_permissions');
          if (cachedPermissionsRaw) {
            try {
              const parsed = JSON.parse(cachedPermissionsRaw) as Record<string, boolean>;
              if (parsed && typeof parsed === 'object' && parsed.dashboard === false) {
                navigate('/admin/orders', { replace: true });
                return;
              }
            } catch {
              localStorage.removeItem('user_permissions');
            }
          }
          setShouldRenderDashboard(true);
          setIsLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          navigateToAdminAuth();
          return;
        }

        const rolePromise = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        const permissionsPromise = supabase
          .from('collaborator_permissions')
          .select('permission_key, granted')
          .eq('user_id', user.id);

        const [roleResult, permissionsResult] = await Promise.all([rolePromise, permissionsPromise]);
        const roleData = roleResult.data;
        const allPermissions = permissionsResult.data;

        if (!roleData) {
          navigateToAdminAuth();
          return;
        }

        const roleValue = roleData.role === 'admin' ? 'admin' : 'collaborator';
        
        // ✅ OTIMIZAÇÃO: Salvar no localStorage para próxima vez
        localStorage.setItem('user_role', roleValue);

        // Se for admin, sempre permitir dashboard
        if (roleValue === 'admin') {
          setShouldRenderDashboard(true);
          setIsLoading(false);
          return;
        }

        const permissionsMap: Record<string, boolean> = {
          orders: true,
          songs: true,
          lyrics: true,
          releases: true,
          dashboard: true,
        };

        if (allPermissions) {
          allPermissions.forEach((perm) => {
            if (perm.granted === true) {
              permissionsMap[perm.permission_key] = true;
            } else if (typeof perm.granted === 'boolean') {
              permissionsMap[perm.permission_key] = perm.granted;
            }
          });
        }

        localStorage.setItem('user_permissions', JSON.stringify(permissionsMap));

        const hasDashboardPermission = permissionsMap.dashboard !== false;

        if (!hasDashboardPermission) {
          const allowedRoutes = [
            { key: 'orders', path: '/admin/orders' },
            { key: 'songs', path: '/admin/songs' },
            { key: 'lyrics', path: '/admin/lyrics' },
            { key: 'releases', path: '/admin/releases' },
          ];

          const firstAllowedRoute = allowedRoutes.find(route => permissionsMap[route.key]);
          if (firstAllowedRoute) {
            navigate(firstAllowedRoute.path, { replace: true });
          } else {
            navigate('/admin/orders', { replace: true });
          }
          return;
        }

        // Tem permissão de dashboard, renderizar
        setShouldRenderDashboard(true);
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        navigateToAdminAuth();
      } finally {
        setIsLoading(false);
      }
    };

    checkAndRedirect();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (shouldRenderDashboard) {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <AdminDashboard />
      </Suspense>
    );
  }

  return null;
}
