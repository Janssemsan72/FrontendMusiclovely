import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Music, RefreshCw, XCircle } from "lucide-react";

export function getAdminDashboardStatusBadge(status: string) {
  const variants: Record<string, { variant: any; icon: any; label: string }> = {
    pending: { variant: "secondary", icon: Clock, label: "Pendente" },
    processing: { variant: "default", icon: RefreshCw, label: "Processando" },
    lyrics_generated: { variant: "default", icon: Music, label: "Letra Gerada" },
    generating_audio: { variant: "default", icon: Music, label: "Gerando Áudio" },
    audio_processing: { variant: "default", icon: Music, label: "Processando Áudio" },
    completed: { variant: "default", icon: CheckCircle, label: "Completo" },
    released: { variant: "default", icon: CheckCircle, label: "Liberado" },
    failed: { variant: "destructive", icon: XCircle, label: "Falhou" },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

