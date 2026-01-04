import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: ReactNode;
  title?: string;
  headerAction?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  compact?: boolean;
  overflowHidden?: boolean;
}

/**
 * Card padrão para páginas admin com padding responsivo
 * Usa o mesmo padrão do AdminDashboard como referência
 */
export function AdminCard({
  children,
  title,
  headerAction,
  className = "",
  headerClassName = "",
  contentClassName = "",
  compact = true,
  overflowHidden = true,
}: AdminCardProps) {
  return (
    <Card
      className={cn(
        compact && "admin-card-compact",
        overflowHidden && "overflow-hidden",
        "border-2 z-0",
        className
      )}
    >
      {title && (
        <CardHeader
          className={cn(
            "pb-1 md:pb-2 p-2 md:p-6 relative z-10",
            headerClassName
          )}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          title ? "p-2 pt-0 md:p-6 md:pt-0" : "p-2 md:p-6",
          "relative z-10",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}



