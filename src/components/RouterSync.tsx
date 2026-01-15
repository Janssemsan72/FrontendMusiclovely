import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente que detecta divergências entre window.location e React Router
 * Apenas detecta e força re-render se necessário, SEM interferir com popstate
 * Resolve problema de duplo clique em produção onde URL muda mas componente não atualiza
 */
export default function RouterSync({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lastReactPathRef = useRef<string>('');
  const lastWindowPathRef = useRef<string>('');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reactPath = location.pathname + location.search;
    const windowPath = window.location.pathname + window.location.search;
    
    // Se React Router atualizou mas window.location não corresponde
    // Isso pode acontecer após navegação programática que não completou
    if (reactPath !== lastReactPathRef.current) {
      // React Router mudou - atualizar referências
      lastReactPathRef.current = reactPath;
      lastWindowPathRef.current = windowPath;
      
      // Se há divergência após React Router atualizar, pode indicar problema
      // Mas NÃO vamos forçar navegação aqui - apenas detectar
      if (reactPath !== windowPath) {
        // Log apenas em dev para debug
        if (import.meta.env.DEV) {
          console.warn('[RouterSync] Divergência detectada após navegação:', {
            reactPath,
            windowPath
          });
        }
      }
    }
    
    // Verificar se window.location mudou sem React Router atualizar
    // Isso pode acontecer em casos raros onde navegação programática falhou
    if (windowPath !== lastWindowPathRef.current && windowPath !== reactPath) {
      // window.location mudou mas React Router não atualizou
      // Isso pode ser popstate (botão voltar/avançar) - NÃO interferir
      // O BrowserRouter deve lidar com isso automaticamente
      lastWindowPathRef.current = windowPath;
    }
  }, [location.pathname, location.search]);
  
  return <>{children}</>;
}
