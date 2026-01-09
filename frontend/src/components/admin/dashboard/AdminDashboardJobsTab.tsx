import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCw } from "lucide-react";
import { getAdminDashboardStatusBadge } from "./statusBadge";

interface Job {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  error?: string;
  orders?: {
    customer_email: string;
    plan: string;
    status?: string;
    paid_at?: string;
    created_at?: string;
  };
}

interface AdminDashboardJobsTabProps {
  jobs: Job[];
  jobsLoading: boolean;
  retryingJob: string | null;
  onRetryJob: (jobId: string) => void;
  onCopyToClipboard: (value: string, label: string) => void;
}

export function AdminDashboardJobsTab({
  jobs,
  jobsLoading,
  retryingJob,
  onRetryJob,
  onCopyToClipboard,
}: AdminDashboardJobsTabProps) {
  return (
    <Card className="admin-card-compact border-2">
      <CardHeader>
        <CardTitle>Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Carregando jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Nenhum job encontrado
            </div>
          ) : (
            jobs.map((job) => {
              const orderStatus = job.orders?.status;
              const isOrderPaid = orderStatus === "paid";
              const isOrderPending = orderStatus === "pending";
              const isJobProcessing = job.status === "processing" || job.status === "pending";

              return (
                <div
                  key={job.id}
                  className={`flex flex-col md:flex-row items-start justify-between p-3 md:p-4 border rounded-lg gap-3 ${
                    isJobProcessing && !isOrderPaid
                      ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
                      : ""
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <p className="text-xs md:text-sm font-medium truncate">
                          {job.orders?.customer_email || "N/A"}
                        </p>
                        {job.orders?.customer_email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0"
                            onClick={() => onCopyToClipboard(job.orders!.customer_email, "Email")}
                            title="Copiar email"
                            aria-label="Copiar email"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {orderStatus && (
                        <Badge
                          variant={isOrderPaid ? "default" : isOrderPending ? "secondary" : "outline"}
                          className="text-xs shrink-0"
                        >
                          {isOrderPaid ? "Pago" : isOrderPending ? "Pendente" : orderStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ID: {job.id.slice(0, 8)} • {job.orders?.plan || "N/A"}
                      {isJobProcessing && !isOrderPaid && (
                        <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                          ⚠️ Processando sem pagamento
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {new Date(job.created_at).toLocaleString("pt-BR")}
                      {job.orders?.paid_at && (
                        <span className="ml-2 text-green-800 dark:text-green-400">
                          • Pago: {new Date(job.orders.paid_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </p>
                    {job.error && (
                      <div className="mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                        <p className="text-destructive font-medium mb-1">Erro:</p>
                        <p className="text-destructive/90 mb-2">{job.error}</p>
                        {(job.error.includes("LOVABLE_API_KEY") ||
                          job.error.includes("OPENAI_API_KEY") ||
                          job.error.includes("ANTHROPIC_API_KEY")) && (
                          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                            <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                              ⚠️ Como resolver:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-yellow-700 dark:text-yellow-300 text-[11px]">
                              <li>Acesse o Supabase Dashboard</li>
                              <li>Vá em Settings → Edge Functions → Environment Variables</li>
                              <li>
                                Adicione a variável{" "}
                                <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">
                                  ANTHROPIC_API_KEY
                                </code>
                              </li>
                              <li>
                                Faça o deploy novamente das funções{" "}
                                <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">
                                  generate-lyrics-internal
                                </code>{" "}
                                e{" "}
                                <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">
                                  generate-lyrics-for-approval
                                </code>
                              </li>
                            </ol>
                            <a
                              href="https://supabase.com/dashboard/project/zagkvtxarndluusiluhb/settings/functions"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-yellow-800 dark:text-yellow-200 underline text-[11px] hover:text-yellow-900 dark:hover:text-yellow-100"
                            >
                              Abrir Supabase Dashboard →
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                    {getAdminDashboardStatusBadge(job.status)}
                    {job.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRetryJob(job.id)}
                        disabled={retryingJob === job.id}
                        className="flex-1 md:flex-none text-xs"
                      >
                        {retryingJob === job.id ? (
                          <RefreshCw className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                            <span className="hidden sm:inline">Retry</span>
                            <span className="sm:hidden">R</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

