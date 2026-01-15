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
    // Mas NÃO forçar navegação se window.location está em '/' e React Router está em outra rota
    // Isso pode causar loops de redirecionamento
    if (windowPath !== reactPath && windowPath !== lastWindowPathRef.current && !isSyncingRef.current) {
      // ✅ CORREÇÃO CRÍTICA: NÃO forçar navegação se window.location está em '/'
      // Isso pode causar loops onde algo redireciona para '/' e RouterSync tenta corrigir
      // Apenas sincronizar se window.location mudou para uma rota diferente de '/'
      if (windowPath === '/') {
        lastWindowPathRef.current = windowPath;
        return;
      }
      
      // Limpar timeout anterior se existir
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      
      // Marcar que está sincronizando para evitar loops
      isSyncingRef.current = true;
      
      // ✅ CORREÇÃO CRÍTICA: Forçar navegação IMEDIATAMENTE sem delays
      // Usar requestAnimationFrame apenas para garantir que está no próximo frame
      requestAnimationFrame(() => {
        // Verificar novamente se ainda há divergência
        const currentWindowPath = window.location.pathname + window.location.search;
        const currentReactPath = location.pathname + location.search;
        
        // Se ainda há divergência, forçar navegação IMEDIATAMENTE
        if (currentWindowPath !== currentReactPath && currentWindowPath !== '/') {
          navigate(currentWindowPath, { replace: true });
        }
        
        // Resetar flag IMEDIATAMENTE após navegação
        isSyncingRef.current = false;
      });
      
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
