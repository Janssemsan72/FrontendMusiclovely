import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialSummaryCardsProps {
  totalRevenue: number; // em centavos
  totalCosts: number; // em centavos
  totalProfit: number; // em centavos
  margin: number; // porcentagem
  isLoading?: boolean;
}

export function FinancialSummaryCards({
  totalRevenue,
  totalCosts,
  totalProfit,
  margin,
  isLoading = false,
}: FinancialSummaryCardsProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de receitas no período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custos Totais</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de custos no período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lucro</CardTitle>
          <TrendingUp
            className={cn(
              "h-4 w-4",
              totalProfit >= 0 ? "text-green-600" : "text-red-600"
            )}
          />
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-bold",
              totalProfit >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {formatCurrency(totalProfit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Receita - Custos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margem</CardTitle>
          <Percent className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-bold",
              margin >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {formatPercent(margin)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Margem de lucro
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


