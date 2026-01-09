import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  canBypassAdminAuth,
  ensureE2EAdminStorageAuthorized,
  navigateToAdminAuthPreservingSearch,
} from '@/utils/adminE2EBypass';
import {
  clearCachedRole,
  getCachedRole,
  runAdminAuthCheck,
  setCachedRole,
  type UserRole,
} from '@/hooks/adminAuthGateCore';

type Navigate = (to: string, options?: any) => void;

export function useAdminAuthGate(params: { navigate: Navigate; pathname: string }) {
  const { navigate, pathname } = params;

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const checkInProgressRef = useRef(false);
  const maxCheckAttemptsRef = useRef(0);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStateSubRef = useRef<any>(null);

  const MAX_CHECK_ATTEMPTS = 3;
  const MAX_CHECK_TIMEOUT_MS = 30000;

  const clearMainTimeout = useCallback(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
  }, []);

  const authorize = useCallback(
    (role: UserRole) => {
      if (!isMountedRef.current) return;
      setIsAuthorized(true);
      setUserRole(role);
      setIsCheckingAuth(false);
      if (role === 'collaborator' && pathname === '/admin') {
        navigate('/admin/orders', { replace: true });
      }
    },
    [navigate, pathname]
  );

  const authorizeE2EAdmin = useCallback(() => {
    setCachedRole('admin');
    clearMainTimeout();
    checkInProgressRef.current = false;
    hasCheckedRef.current = true;
    maxCheckAttemptsRef.current = 0;
    authorize('admin');
  }, [authorize, clearMainTimeout]);

  const ensureE2EAdminAuthorized = useCallback(() => {
    if (!ensureE2EAdminStorageAuthorized()) return false;
    authorizeE2EAdmin();
    return true;
  }, [authorizeE2EAdmin]);

  const navigateToAdminAuth = useCallback(() => {
    if (ensureE2EAdminAuthorized()) return true;
    return navigateToAdminAuthPreservingSearch(navigate);
  }, [ensureE2EAdminAuthorized, navigate]);

  const clearRoleAndNavigateToAdminAuth = useCallback(() => {
    if (ensureE2EAdminAuthorized()) return true;
    clearCachedRole();
    return navigateToAdminAuthPreservingSearch(navigate);
  }, [ensureE2EAdminAuthorized, navigate]);

  const checkAdminAccess = useCallback(async () => {
    try {
      await runAdminAuthCheck({
        isMountedRef,
        hasCheckedRef,
        checkInProgressRef,
        maxCheckAttemptsRef,
        checkTimeoutRef,
        maxAttempts: MAX_CHECK_ATTEMPTS,
        maxTimeoutMs: MAX_CHECK_TIMEOUT_MS,
        ensureE2EAdminAuthorized,
        navigateToAdminAuth,
        clearRoleAndNavigateToAdminAuth,
        setIsCheckingAuth,
        setIsAuthorized,
        authorize,
      });
    } catch (error: any) {
      if (!String(error?.message ?? '').includes('Timeout')) throw error;
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
      setTimeout(() => {
        if (isMountedRef.current && maxCheckAttemptsRef.current < MAX_CHECK_ATTEMPTS) {
          checkAdminAccess().catch((retryError) => console.error('Erro no retry:', retryError));
        }
      }, 1000);
    }
  }, [
    MAX_CHECK_ATTEMPTS,
    MAX_CHECK_TIMEOUT_MS,
    authorize,
    clearRoleAndNavigateToAdminAuth,
    ensureE2EAdminAuthorized,
    navigateToAdminAuth,
  ]);

  useEffect(() => {
    if (!supabase?.auth) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session?.user) return;
        const cachedRole = getCachedRole();
        if (cachedRole) {
          authorize(cachedRole);
          return;
        }
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .limit(1)
          .then(({ data }) => {
            const roleValue = data?.[0]?.role;
            const isAdmin = roleValue === 'admin' || String(roleValue) === 'admin';
            const isCollaborator = roleValue === 'collaborator' || String(roleValue) === 'collaborator';
            if (!isAdmin && !isCollaborator) return;
            const role: UserRole = isAdmin ? 'admin' : 'collaborator';
            setCachedRole(role);
            authorize(role);
          })
          .catch((err) => console.error('Erro ao verificar role após renovação:', err));
        return;
      }

      if (event === 'SIGNED_OUT') {
        try {
          if (canBypassAdminAuth() && localStorage.getItem('e2e_admin') === 'true') return;
        } catch {
          void 0;
        }
        if (!isMountedRef.current) return;
        setIsAuthorized(false);
        setUserRole(null);
        setIsCheckingAuth(false);
        clearCachedRole();
      }
    });

    authStateSubRef.current = subscription;
    return () => {
      if (authStateSubRef.current) {
        authStateSubRef.current.unsubscribe();
        authStateSubRef.current = null;
      }
    };
  }, [authorize]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      hasCheckedRef.current = false;
      checkInProgressRef.current = false;
      maxCheckAttemptsRef.current = 0;
      clearMainTimeout();
      if (authStateSubRef.current) {
        authStateSubRef.current.unsubscribe();
        authStateSubRef.current = null;
      }
    };
  }, [clearMainTimeout]);

  useEffect(() => {
    try {
      if (ensureE2EAdminAuthorized()) return;
    } catch {
      void 0;
    }

    if (isMountedRef.current && !hasCheckedRef.current && !checkInProgressRef.current) {
      checkAdminAccess().catch((error) => {
        console.error('Erro não tratado em checkAdminAccess:', error);
        hasCheckedRef.current = false;
        checkInProgressRef.current = false;
        if (isMountedRef.current) {
          setIsCheckingAuth(false);
        }
      });
    }
  }, [checkAdminAccess, ensureE2EAdminAuthorized]);

  const handleLogout = useCallback(async () => {
    const isDev = import.meta.env.MODE !== 'production';
    try {
      setIsAuthorized(false);
      setUserRole(null);
      clearCachedRole();
      hasCheckedRef.current = false;
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/admin/auth');
    } catch (error) {
      if (isDev) console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao sair');
    }
  }, [navigate]);

  return { isCheckingAuth, isAuthorized, userRole, handleLogout };
}

