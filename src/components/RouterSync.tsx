import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Componente que força sincronização entre window.location e React Router
 * Resolve problema de duplo clique em produção onde URL muda mas componente não atualiza
 */
export default function RouterSync({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastWindowPathRef = useRef<string>('');
  const isSyncingRef = useRef(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkSync = () => {
      // Evitar loops de sincronização
      if (isSyncingRef.current) return;
      
      const windowPath = window.location.pathname + window.location.search;
      const reactPath = location.pathname + location.search;
      const lastWindowPath = lastWindowPathRef.current;
      
      // Se window.location mudou mas React Router não atualizou
      if (windowPath !== reactPath && windowPath !== lastWindowPath) {
        isSyncingRef.current = true;
        
        // Forçar navegação para sincronizar
        navigate(windowPath, { replace: true });
        
        // Resetar flag após navegação
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
      
      lastWindowPathRef.current = windowPath;
    };
    
    // Verificar sincronização periodicamente usando requestAnimationFrame
    let rafId: number | null = null;
    
    const scheduleCheck = () => {
      rafId = requestAnimationFrame(() => {
        checkSync();
        scheduleCheck();
      });
    };
    
    scheduleCheck();
    
    // Também verificar em eventos de navegação
    const handlePopState = () => {
      checkSync();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('popstate', handlePopState);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [location.pathname, location.search, navigate]);
  
  return <>{children}</>;
}
