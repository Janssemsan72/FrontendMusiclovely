import { FinancialSummaryCards } from "./FinancialSummaryCards";
import { FinancialCharts } from "./FinancialCharts";
import { useFinancialSummary } from "@/hooks/useFinancialData";
import { useMemo } from "react";

interface FinancialDashboardProps {
  startDate: string;
  endDate: string;
}

export function FinancialDashboard({ startDate, endDate }: FinancialDashboardProps) {
  const { data: summary, isLoading } = useFinancialSummary({ startDate, endDate });

  const stats = useMemo(() => {
    if (!summary) {
      return {
        totalRevenue: 0,
        totalCosts: 0,
        totalProfit: 0,
        margin: 0,
        summaries: [],
      };
    }

    return {
      totalRevenue: summary.totalRevenue,
      totalCosts: summary.totalCosts,
      totalProfit: summary.totalProfit,
      margin: summary.margin,
      summaries: summary.summaries,
    };
  }, [summary]);

  return (
    <div className="space-y-6">
      <FinancialSummaryCards
        totalRevenue={stats.totalRevenue}
        totalCosts={stats.totalCosts}
        totalProfit={stats.totalProfit}
        margin={stats.margin}
        isLoading={isLoading}
      />
      <FinancialCharts summaries={stats.summaries} isLoading={isLoading} />
    </div>
  );
}


