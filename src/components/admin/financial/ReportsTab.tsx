import { useState, useMemo } from "react";
import { useDailySummary, useFinancialSummary } from "@/hooks/useFinancialData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ReportsTab() {
  const [reportType, setReportType] = useState<"daily" | "monthly" | "comparative">("daily");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [compareMonth1, setCompareMonth1] = useState<string>(format(subMonths(new Date(), 1), "yyyy-MM"));
  const [compareMonth2, setCompareMonth2] = useState<string>(format(new Date(), "yyyy-MM"));

  const dailyDateRange = useMemo(() => {
    const date = new Date(selectedDate);
    return {
      startDate: format(date, "yyyy-MM-dd"),
      endDate: format(date, "yyyy-MM-dd"),
    };
  }, [selectedDate]);

  const monthlyDateRange = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return {
      startDate: format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  const compareDateRange1 = useMemo(() => {
    const [year, month] = compareMonth1.split("-").map(Number);
    return {
      startDate: format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
    };
  }, [compareMonth1]);

  const compareDateRange2 = useMemo(() => {
    const [year, month] = compareMonth2.split("-").map(Number);
    return {
      startDate: format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"),
    };
  }, [compareMonth2]);

  const { data: dailyData } = useDailySummary(dailyDateRange);
  const { data: monthlyData } = useFinancialSummary(monthlyDateRange);
  const { data: compareData1 } = useFinancialSummary(compareDateRange1);
  const { data: compareData2 } = useFinancialSummary(compareDateRange2);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const handleExport = () => {
    // TODO: Implementar exportação CSV/PDF
    alert("Exportação será implementada em breve");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground">Visualize relatórios financeiros detalhados</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={reportType === "daily" ? "default" : "outline"}
              onClick={() => setReportType("daily")}
            >
              Diário
            </Button>
            <Button
              variant={reportType === "monthly" ? "default" : "outline"}
              onClick={() => setReportType("monthly")}
            >
              Mensal
            </Button>
            <Button
              variant={reportType === "comparative" ? "default" : "outline"}
              onClick={() => setReportType("comparative")}
            >
              Comparativo
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportType === "daily" && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório Diário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="daily-date">Data</Label>
              <Input
                id="daily-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            {dailyData && dailyData.length > 0 ? (
              <div className="space-y-2">
                {dailyData.map((day) => (
                  <div key={day.id} className="border rounded p-4">
                    <h3 className="font-semibold">{format(new Date(day.date), "dd/MM/yyyy")}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      <div><span className="text-sm text-muted-foreground">Receita:</span> <span className="font-semibold text-green-600">{formatCurrency(day.revenue_cents)}</span></div>
                      <div><span className="text-sm text-muted-foreground">Custos:</span> <span className="font-semibold text-red-600">{formatCurrency(day.costs_cents)}</span></div>
                      <div><span className="text-sm text-muted-foreground">Lucro:</span> <span className={`font-semibold ${day.profit_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(day.profit_cents)}</span></div>
                      <div><span className="text-sm text-muted-foreground">Margem:</span> <span className={`font-semibold ${day.revenue_cents > 0 ? (day.profit_cents / day.revenue_cents * 100 >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>{day.revenue_cents > 0 ? formatPercent(day.profit_cents / day.revenue_cents * 100) : '0%'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível para esta data</p>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "monthly" && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório Mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="monthly-date">Mês</Label>
              <Input
                id="monthly-date"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            {monthlyData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded p-4">
                    <p className="text-sm text-muted-foreground">Receita Total</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyData.totalRevenue)}</p>
                  </div>
                  <div className="border rounded p-4">
                    <p className="text-sm text-muted-foreground">Custos Totais</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(monthlyData.totalCosts)}</p>
                  </div>
                  <div className="border rounded p-4">
                    <p className="text-sm text-muted-foreground">Lucro</p>
                    <p className={`text-2xl font-bold ${monthlyData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(monthlyData.totalProfit)}</p>
                  </div>
                  <div className="border rounded p-4">
                    <p className="text-sm text-muted-foreground">Margem</p>
                    <p className={`text-2xl font-bold ${monthlyData.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(monthlyData.margin)}</p>
                  </div>
                </div>
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">Detalhamento</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Vendas Cakto:</span> {formatCurrency(monthlyData.totalCakto)}</div>
                    <div><span className="text-muted-foreground">Vendas PIX:</span> {formatCurrency(monthlyData.totalPix)}</div>
                    <div><span className="text-muted-foreground">Ajustes:</span> {formatCurrency(monthlyData.totalAdjustments)}</div>
                    <div><span className="text-muted-foreground">Reembolsos:</span> {formatCurrency(monthlyData.totalRefunds)}</div>
                    <div><span className="text-muted-foreground">Custos Fixos:</span> {formatCurrency(monthlyData.totalFixed)}</div>
                    <div><span className="text-muted-foreground">Custos Variáveis:</span> {formatCurrency(monthlyData.totalVariable)}</div>
                    <div><span className="text-muted-foreground">Custos de API:</span> {formatCurrency(monthlyData.totalApi)}</div>
                    <div><span className="text-muted-foreground">Tráfego Pago:</span> {formatCurrency(monthlyData.totalTraffic)}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "comparative" && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório Comparativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="compare-month1">Mês 1</Label>
                <Input
                  id="compare-month1"
                  type="month"
                  value={compareMonth1}
                  onChange={(e) => setCompareMonth1(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="compare-month2">Mês 2</Label>
                <Input
                  id="compare-month2"
                  type="month"
                  value={compareMonth2}
                  onChange={(e) => setCompareMonth2(e.target.value)}
                />
              </div>
            </div>
            {compareData1 && compareData2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded p-4">
                    <h3 className="font-semibold mb-2">{format(new Date(compareMonth1 + "-01"), "MMMM yyyy", { locale: ptBR })}</h3>
                    <div className="space-y-1 text-sm">
                      <div><span className="text-muted-foreground">Receita:</span> {formatCurrency(compareData1.totalRevenue)}</div>
                      <div><span className="text-muted-foreground">Custos:</span> {formatCurrency(compareData1.totalCosts)}</div>
                      <div><span className="text-muted-foreground">Lucro:</span> <span className={compareData1.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(compareData1.totalProfit)}</span></div>
                      <div><span className="text-muted-foreground">Margem:</span> <span className={compareData1.margin >= 0 ? 'text-green-600' : 'text-red-600'}>{formatPercent(compareData1.margin)}</span></div>
                    </div>
                  </div>
                  <div className="border rounded p-4">
                    <h3 className="font-semibold mb-2">{format(new Date(compareMonth2 + "-01"), "MMMM yyyy", { locale: ptBR })}</h3>
                    <div className="space-y-1 text-sm">
                      <div><span className="text-muted-foreground">Receita:</span> {formatCurrency(compareData2.totalRevenue)}</div>
                      <div><span className="text-muted-foreground">Custos:</span> {formatCurrency(compareData2.totalCosts)}</div>
                      <div><span className="text-muted-foreground">Lucro:</span> <span className={compareData2.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(compareData2.totalProfit)}</span></div>
                      <div><span className="text-muted-foreground">Margem:</span> <span className={compareData2.margin >= 0 ? 'text-green-600' : 'text-red-600'}>{formatPercent(compareData2.margin)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="border rounded p-4 bg-muted">
                  <h3 className="font-semibold mb-2">Variação</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Receita:</span>
                      <span className={`ml-2 font-semibold ${compareData2.totalRevenue >= compareData1.totalRevenue ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(((compareData2.totalRevenue - compareData1.totalRevenue) / (compareData1.totalRevenue || 1)) * 100)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custos:</span>
                      <span className={`ml-2 font-semibold ${compareData2.totalCosts <= compareData1.totalCosts ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(((compareData2.totalCosts - compareData1.totalCosts) / (compareData1.totalCosts || 1)) * 100)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lucro:</span>
                      <span className={`ml-2 font-semibold ${compareData2.totalProfit >= compareData1.totalProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(((compareData2.totalProfit - compareData1.totalProfit) / (Math.abs(compareData1.totalProfit) || 1)) * 100)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Margem:</span>
                      <span className={`ml-2 font-semibold ${compareData2.margin >= compareData1.margin ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(compareData2.margin - compareData1.margin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

