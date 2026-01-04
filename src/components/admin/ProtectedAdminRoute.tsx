import { ReactNode } from 'react';
import { useCollaboratorPermissions } from '@/hooks/useCollaboratorPermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedAdminRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedAdminRoute({ children, requiredPermission }: ProtectedAdminRouteProps) {
  const { hasPermission, isLoading } = useCollaboratorPermissions(requiredPermission);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasPermission === false) {
    return null; // O hook já redireciona
  }

  return <>{children}</>;
}

