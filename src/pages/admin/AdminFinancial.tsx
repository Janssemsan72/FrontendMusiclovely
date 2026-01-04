import { useState, useMemo } from "react";
import { EnhancedTabs, EnhancedTabsContent, EnhancedTabsList, EnhancedTabsTrigger } from "@/components/ui/enhanced-tabs";
import { FinancialDashboard } from "@/components/admin/financial/FinancialDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Receipt, 
  ShoppingCart, 
  Settings, 
  BarChart3,
  Zap,
  FileText
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

// Importar tabs (serão criadas em seguida)
import { FixedCostsTab } from "@/components/admin/financial/FixedCostsTab";
import { VariableCostsTab } from "@/components/admin/financial/VariableCostsTab";
import { ApiCostsTab } from "@/components/admin/financial/ApiCostsTab";
import { RefundsTab } from "@/components/admin/financial/RefundsTab";
import { PixSalesTab } from "@/components/admin/financial/PixSalesTab";
import { AdjustmentsTab } from "@/components/admin/financial/AdjustmentsTab";
import { PaidTrafficTab } from "@/components/admin/financial/PaidTrafficTab";
import { CaktoSalesTab } from "@/components/admin/financial/CaktoSalesTab";
import { ReportsTab } from "@/components/admin/financial/ReportsTab";

export default function AdminFinancial() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const dateRange = useMemo(() => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (period) {
      case "today":
        startDate = today;
        break;
      case "week":
        startDate = subDays(today, 7);
        break;
      case "month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "year":
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        } else {
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
        }
        break;
      default:
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
  }, [period, customStartDate, customEndDate]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão Financeira</h1>
          <p className="text-muted-foreground mt-1">
            Controle completo de receitas, custos e despesas
          </p>
        </div>
      </div>

      <EnhancedTabs value={activeTab} onValueChange={setActiveTab} variant="modern">
        <EnhancedTabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-10">
          <EnhancedTabsTrigger value="dashboard" icon={<BarChart3 className="h-4 w-4" />}>
            Dashboard
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="fixed-costs" icon={<Settings className="h-4 w-4" />}>
            Custos Fixos
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="variable-costs" icon={<TrendingDown className="h-4 w-4" />}>
            Custos Variáveis
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="api-costs" icon={<Zap className="h-4 w-4" />}>
            Despesas API
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="cakto-sales" icon={<ShoppingCart className="h-4 w-4" />}>
            Vendas Cakto
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="pix-sales" icon={<CreditCard className="h-4 w-4" />}>
            Vendas PIX
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="adjustments" icon={<Receipt className="h-4 w-4" />}>
            Ajustes
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="refunds" icon={<TrendingUp className="h-4 w-4" />}>
            Reembolsos
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="traffic" icon={<DollarSign className="h-4 w-4" />}>
            Tráfego Pago
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger value="reports" icon={<FileText className="h-4 w-4" />}>
            Relatórios
          </EnhancedTabsTrigger>
        </EnhancedTabsList>

        <EnhancedTabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPeriod("today")}
                    className={`px-4 py-2 rounded-md text-sm ${
                      period === "today"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => setPeriod("week")}
                    className={`px-4 py-2 rounded-md text-sm ${
                      period === "week"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setPeriod("month")}
                    className={`px-4 py-2 rounded-md text-sm ${
                      period === "month"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => setPeriod("year")}
                    className={`px-4 py-2 rounded-md text-sm ${
                      period === "year"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    Ano
                  </button>
                  <button
                    onClick={() => setPeriod("custom")}
                    className={`px-4 py-2 rounded-md text-sm ${
                      period === "custom"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    Personalizado
                  </button>
                </div>
                {period === "custom" && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <FinancialDashboard startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="fixed-costs">
          <FixedCostsTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="variable-costs">
          <VariableCostsTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="api-costs">
          <ApiCostsTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="cakto-sales">
          <CaktoSalesTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="pix-sales">
          <PixSalesTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="adjustments">
          <AdjustmentsTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="refunds">
          <RefundsTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="traffic">
          <PaidTrafficTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="reports">
          <ReportsTab />
        </EnhancedTabsContent>
      </EnhancedTabs>
    </div>
  );
}

