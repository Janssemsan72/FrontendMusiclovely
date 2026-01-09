import { Card } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface LogsKPICardsProps {
  totalEvents: number;
  errorCount: number;
  successRate: number;
  lastUpdate: Date | null;
}

export function LogsKPICards({ totalEvents, errorCount, successRate, lastUpdate }: LogsKPICardsProps) {
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Nunca';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h atrás`;
  };

  return (
    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4">
      <div className="grid grid-cols-2 gap-3 md:contents">
        <Card className="p-3 md:p-4 mobile-compact-card">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">Total de Eventos</p>
              <p className="text-lg md:text-2xl font-bold">{totalEvents.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 mobile-compact-card">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">Erros</p>
              <p className="text-lg md:text-2xl font-bold">{errorCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:contents">
        <Card className="p-3 md:p-4 mobile-compact-card">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">Taxa de Sucesso</p>
              <p className="text-lg md:text-2xl font-bold">{successRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 mobile-compact-card">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">Última Atualização</p>
              <p className="text-sm md:text-lg font-semibold">{formatLastUpdate(lastUpdate)}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
