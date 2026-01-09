import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceInfo, getOptimizedTimeout } from '@/utils/detection/deviceDetection';

export type UserRole = 'admin' | 'collaborator';

type MutableRefObject<T> = { current: T };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function getCachedRole(): UserRole | null {
  try {
    const v = localStorage.getItem('user_role');
    return v === 'admin' || v === 'collaborator' ? v : null;
  } catch {
    return null;
  }
}

export function setCachedRole(role: UserRole) {
  try {
    localStorage.setItem('user_role', role);
  } catch {
    void 0;
  }
}

export function clearCachedRole() {
  try {
    localStorage.removeItem('user_role');
  } catch {
    void 0;
  }
}

async function getSessionUserWithRecovery() {
  await sleep(100);
  const firstAttempt = await supabase.auth.getSession();
  if (firstAttempt.data.session?.user) return firstAttempt.data.session.user;

  const cachedRole = getCachedRole();
  if (!cachedRole) return null;

  try {
    const refresh = await supabase.auth.refreshSession();
    if (refresh.data.session?.user) return refresh.data.session.user;
  } catch (error) {
    console.error('Erro ao renovar token:', error);
  }

  await sleep(300);
  const retry = await supabase.auth.getSession();
  return retry.data.session?.user ?? null;
}

async function verifyRoleWithTimeout(userId: string): Promise<UserRole | null> {
  const deviceInfo = getDeviceInfo();
  const baseTimeout = deviceInfo.isMobile || deviceInfo.isSlowConnection ? 3000 : 5000;
  const timeoutMs = getOptimizedTimeout(baseTimeout);

  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout na verificação de permissões')), timeoutMs);
  });

  const rolesPromise = supabase.from('user_roles').select('role').eq('user_id', userId).limit(1);

  const readRoleFromRow = (row: any): UserRole | null => {
    const roleValue = row?.role;
    const isAdmin = roleValue === 'admin' || String(roleValue) === 'admin';
    const isCollaborator = roleValue === 'collaborator' || String(roleValue) === 'collaborator';
    if (isAdmin) return 'admin';
    if (isCollaborator) return 'collaborator';
    return null;
  };

  try {
    const rolesResult: any = await Promise.race([
      rolesPromise.then((r: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        return r;
      }),
      timeoutPromise,
    ]);

    const { data, error } = rolesResult;
    if (error) throw error;
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return readRoleFromRow(row);
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (!String(error?.message ?? '').includes('Timeout')) throw error;

    const { data: retryRow, error: retryError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (retryError) throw retryError;
    return readRoleFromRow(retryRow);
  }
}

export async function runAdminAuthCheck(params: {
  isMountedRef: MutableRefObject<boolean>;
  hasCheckedRef: MutableRefObject<boolean>;
  checkInProgressRef: MutableRefObject<boolean>;
  maxCheckAttemptsRef: MutableRefObject<number>;
  checkTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  maxAttempts: number;
  maxTimeoutMs: number;
  ensureE2EAdminAuthorized: () => boolean;
  navigateToAdminAuth: () => boolean;
  clearRoleAndNavigateToAdminAuth: () => boolean;
  setIsCheckingAuth: (v: boolean) => void;
  setIsAuthorized: (v: boolean) => void;
  authorize: (role: UserRole) => void;
}) {
  const {
    isMountedRef,
    hasCheckedRef,
    checkInProgressRef,
    maxCheckAttemptsRef,
    checkTimeoutRef,
    maxAttempts,
    maxTimeoutMs,
    ensureE2EAdminAuthorized,
    navigateToAdminAuth,
    clearRoleAndNavigateToAdminAuth,
    setIsCheckingAuth,
    setIsAuthorized,
    authorize,
  } = params;

  const clearMainTimeout = () => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
  };

  try {
    if (ensureE2EAdminAuthorized()) return;
  } catch {
    void 0;
  }

  if (checkInProgressRef.current) return;

  if (maxCheckAttemptsRef.current >= maxAttempts) {
    if (isMountedRef.current) {
      if (navigateToAdminAuth()) return;
      setIsCheckingAuth(false);
    }
    return;
  }

  clearMainTimeout();
  checkTimeoutRef.current = setTimeout(() => {
    checkInProgressRef.current = false;
    hasCheckedRef.current = false;
    maxCheckAttemptsRef.current++;
    if (!isMountedRef.current) return;
    if (ensureE2EAdminAuthorized()) return;
    toast.error('Timeout na verificação de autenticação');
    navigateToAdminAuth();
    setIsCheckingAuth(false);
  }, maxTimeoutMs);

  checkInProgressRef.current = true;
  hasCheckedRef.current = true;
  maxCheckAttemptsRef.current++;
  setIsCheckingAuth(true);
  setIsAuthorized(false);

  try {
    if (!supabase?.auth) {
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
      maxCheckAttemptsRef.current = 0;
      clearMainTimeout();
      if (isMountedRef.current) {
        toast.error('Erro de inicialização. Recarregue a página.');
        setIsCheckingAuth(false);
      }
      return;
    }

    const cachedRole = getCachedRole();
    if (cachedRole) {
      authorize(cachedRole);
      checkInProgressRef.current = false;
      clearMainTimeout();
      maxCheckAttemptsRef.current = 0;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        clearRoleAndNavigateToAdminAuth();
        return;
      }

      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .limit(1)
        .then(({ data }) => {
          const roleValue = data?.[0]?.role;
          const actual = roleValue === 'admin' ? 'admin' : 'collaborator';
          if (actual !== cachedRole) setCachedRole(actual);
        })
        .catch(() => void 0);

      return;
    }

    const user = await getSessionUserWithRecovery();
    if (!user) {
      if (ensureE2EAdminAuthorized()) return;
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
      if (isMountedRef.current) {
        clearRoleAndNavigateToAdminAuth();
        setIsCheckingAuth(false);
      }
      return;
    }

    const role = await verifyRoleWithTimeout(user.id);
    if (!role) {
      if (isMountedRef.current) {
        toast.error('Acesso negado - apenas administradores e colaboradores');
        if (navigateToAdminAuth()) return;
        setIsCheckingAuth(false);
      }
      hasCheckedRef.current = false;
      return;
    }

    setCachedRole(role);
    authorize(role);
    clearMainTimeout();
    maxCheckAttemptsRef.current = 0;
    hasCheckedRef.current = true;
    checkInProgressRef.current = false;
  } catch (error: any) {
    console.error('Erro inesperado na verificação:', error);
    clearMainTimeout();

    if (maxCheckAttemptsRef.current >= maxAttempts) {
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
      if (isMountedRef.current) {
        toast.error('Erro ao verificar autenticação. Limite de tentativas excedido.');
        if (navigateToAdminAuth()) return;
        setIsCheckingAuth(false);
      }
      return;
    }

    if (String(error?.message ?? '').includes('Timeout')) throw error;

    if (isMountedRef.current) {
      toast.error('Erro ao verificar autenticação');
      if (navigateToAdminAuth()) return;
      setIsCheckingAuth(false);
    }
    checkInProgressRef.current = false;
    hasCheckedRef.current = false;
  } finally {
    if (isMountedRef.current) {
      setIsCheckingAuth(false);
    }
  }
}
