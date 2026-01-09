export function canBypassAdminAuth(): boolean {
  if (import.meta.env.MODE !== 'production') return true;
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname || '';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') return true;
  return import.meta.env.VITE_E2E === 'true';
}

export function getCurrentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search || '';
}

export function consumeE2EAdminParam(): boolean {
  try {
    if (!canBypassAdminAuth()) return false;
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
}

export function isE2EAdminFlagEnabled(): boolean {
  try {
    if (!canBypassAdminAuth()) return false;
    return localStorage.getItem('e2e_admin') === 'true';
  } catch {
    return false;
  }
}

export function ensureE2EAdminStorageAuthorized(): boolean {
  if (isE2EAdminFlagEnabled() || consumeE2EAdminParam()) {
    try {
      localStorage.setItem('user_role', 'admin');
    } catch {
      void 0;
    }
    return true;
  }
  return false;
}

export function navigateToAdminAuthPreservingSearch(navigate: (to: string, options?: any) => void): boolean {
  if (ensureE2EAdminStorageAuthorized()) return true;
  const search = getCurrentSearch();
  navigate(`/admin/auth${search}`);
  return false;
}

