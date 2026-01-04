import { RefreshCw } from "lucide-react";

interface AdminPageLoadingProps {
  text?: string;
  className?: string;
}

/**
 * ✅ Componente de loading unificado para todas as páginas admin
 * Garante consistência visual e evita múltiplos loadings
 */
export function AdminPageLoading({ 
  text = "Carregando...", 
  className = "" 
}: AdminPageLoadingProps) {
  return (
    <div
      data-testid="admin-page-loading"
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center min-h-[60vh] ${className}`}
    >
      <div className="text-center space-y-4">
        <RefreshCw data-testid="admin-page-loading-spinner" className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p data-testid="admin-page-loading-text" className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

