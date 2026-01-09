import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function HeatmapLinks() {
  return (
    <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2 bg-gradient-to-r from-gray-600 to-gray-800 bg-clip-text text-transparent">
          <AlertCircle className="h-5 w-5 text-gray-600" />
          Analytics de Comportamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-4">
          Ferramentas de analytics (Clarity e Hotjar) foram removidas do sistema.
        </p>
      </CardContent>
    </Card>
  );
}

