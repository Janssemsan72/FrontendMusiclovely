import { Badge } from "@/components/ui/badge";

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const variants: Record<string, { variant: any; label: string }> = {
    pending: { variant: "secondary", label: "Pendente" },
    paid: { variant: "default", label: "Pago" },
    cancelled: { variant: "destructive", label: "Cancelado" },
    refunded: { variant: "outline", label: "Reembolsado" },
    failed: { variant: "destructive", label: "Falhou" },
  };

  const config = variants[status] || { variant: "secondary", label: status };

  return <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 h-5">{config.label}</Badge>;
}
