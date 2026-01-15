import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Componente que detecta divergências entre window.location e React Router
 * e força atualização quando necessário
 * Resolve problema onde URL muda mas componente não renderiza
 */
export default function RouterSync({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastReactPathRef = useRef<string>('');
  const lastWindowPathRef = useRef<string>('');
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reactPath = location.pathname + location.search;
    const windowPath = window.location.pathname + window.location.search;
    
    // Se React Router atualizou, atualizar referências
    if (reactPath !== lastReactPathRef.current) {
      lastReactPathRef.current = reactPath;
      lastWindowPathRef.current = windowPath;
      isSyncingRef.current = false;
      
      // Limpar timeout se existir
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    }
    
    // ✅ CORREÇÃO CRÍTICA: Se window.location mudou mas React Router não atualizou
    // Forçar navegação após um pequeno delay para dar tempo do React Router processar
    if (windowPath !== reactPath && windowPath !== lastWindowPathRef.current && !isSyncingRef.current) {
      // Limpar timeout anterior se existir
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      // Marcar que está sincronizando para evitar loops
      isSyncingRef.current = true;
      
      // Aguardar um pouco para dar tempo do React Router processar naturalmente
      syncTimeoutRef.current = setTimeout(() => {
        // Verificar novamente se ainda há divergência
        const currentWindowPath = window.location.pathname + window.location.search;
        const currentReactPath = location.pathname + location.search;
        
        // Se ainda há divergência após delay, forçar navegação
        if (currentWindowPath !== currentReactPath && currentWindowPath === windowPath) {
          // Usar requestAnimationFrame para garantir que está no próximo frame
          requestAnimationFrame(() => {
            // Forçar navegação apenas se não estiver sincronizando
            if (!isSyncingRef.current) return;
            
            navigate(currentWindowPath, { replace: true });
            
            // Resetar flag após navegação
            setTimeout(() => {
              isSyncingRef.current = false;
            }, 100);
          });
        } else {
          // Divergência foi resolvida, resetar flag
          isSyncingRef.current = false;
        }
        
        syncTimeoutRef.current = null;
      }, 100); // Delay de 100ms para dar tempo do React Router processar
      
      lastWindowPathRef.current = windowPath;
    }
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [location.pathname, location.search, navigate]);
  
  return <>{children}</>;
}
