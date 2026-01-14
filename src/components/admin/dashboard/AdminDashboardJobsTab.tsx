import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import { Copy, RefreshCw, Check } from "@/utils/iconImports";
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
  // ✅ Paginação
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function AdminDashboardJobsTab({
  jobs,
  jobsLoading,
  retryingJob,
  onRetryJob,
  onCopyToClipboard,
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: AdminDashboardJobsTabProps) {
  // ✅ Estado para controlar qual erro foi copiado
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  
  // ✅ Função para copiar erro
  const handleCopyError = async (error: string, jobId: string) => {
    try {
      await navigator.clipboard.writeText(error);
      setCopiedErrorId(jobId);
      setTimeout(() => setCopiedErrorId(null), 2000);
      onCopyToClipboard(error, "Erro do job");
    } catch (err) {
      // Fallback para navegadores que não suportam clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = error;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedErrorId(jobId);
        setTimeout(() => setCopiedErrorId(null), 2000);
        onCopyToClipboard(error, "Erro do job");
      } catch (copyErr) {
        console.error('Erro ao copiar:', copyErr);
      } finally {
        textArea.remove();
      }
    }
  };
  
  // Calcular informações de paginação
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  
  // Função para gerar números de página para exibição
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Mostrar todas as páginas se houver poucas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Sempre mostrar primeira página
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      // Mostrar páginas ao redor da atual
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Sempre mostrar última página
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  return (
    <Card className="admin-card-compact border-2">
      <CardHeader>
        <CardTitle>Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {/* ✅ Controles de Paginação - Topo */}
        {total > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 rounded-lg">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{endIndex} de {total}
              </p>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(value) => {
                  onPageSizeChange(Number(value));
                }}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Paginação */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          onPageChange(currentPage - 1);
                        }
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            onPageChange(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          onPageChange(currentPage + 1);
                        }
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
        
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
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-destructive font-medium">Erro:</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0 opacity-60 hover:opacity-100"
                            onClick={() => handleCopyError(job.error!, job.id)}
                            title="Copiar erro"
                            aria-label="Copiar erro"
                          >
                            {copiedErrorId === job.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-destructive/90 mb-2 select-text break-words">{job.error}</p>
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

