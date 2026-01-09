import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { DailyFinancialSummary } from "@/types/admin";

interface FinancialChartsProps {
  summaries: DailyFinancialSummary[];
  isLoading?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function FinancialCharts({ summaries, isLoading = false }: FinancialChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // Preparar dados para gráfico de linha (Receita vs Custos)
  const lineData = summaries.map((s) => ({
    date: formatDate(s.date),
    Receita: s.revenue_cents,
    Custos: s.costs_cents,
    Lucro: s.profit_cents,
  }));

  // Preparar dados para gráfico de pizza (Distribuição de Custos)
  const costData = summaries.length > 0
    ? [
        { name: 'Custos Fixos', value: summaries.reduce((sum, s) => sum + s.fixed_costs_cents, 0) },
        { name: 'Custos Variáveis', value: summaries.reduce((sum, s) => sum + s.variable_costs_cents, 0) },
        { name: 'Custos de API', value: summaries.reduce((sum, s) => sum + s.api_costs_cents, 0) },
        { name: 'Tráfego Pago', value: summaries.reduce((sum, s) => sum + s.traffic_costs_cents, 0) },
      ].filter((item) => item.value > 0)
    : [];

  // Preparar dados para gráfico de barras (Receitas por tipo)
  const revenueData = summaries.length > 0
    ? [
        {
          date: 'Total',
          'Vendas Cakto': summaries.reduce((sum, s) => sum + s.cakto_sales_cents, 0),
          'Vendas PIX': summaries.reduce((sum, s) => sum + s.pix_sales_cents, 0),
          'Ajustes': summaries.reduce((sum, s) => sum + s.adjustments_cents, 0),
        },
      ]
    : [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Receita vs Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="Receita" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="Custos" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="Lucro" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          {costData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Receitas por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Vendas Cakto" fill="#22c55e" />
                <Bar dataKey="Vendas PIX" fill="#3b82f6" />
                <Bar dataKey="Ajustes" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


