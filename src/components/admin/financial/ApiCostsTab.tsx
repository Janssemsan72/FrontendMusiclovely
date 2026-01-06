import { useState } from "react";
import { useApiCosts, useCreateApiCost, useUpdateApiCost, useDeleteApiCost } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { ApiCost } from "@/types/admin";
import { format } from "date-fns";

export function ApiCostsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ApiCost | null>(null);
  const { data: costs, isLoading } = useApiCosts();
  const createMutation = useCreateApiCost();
  const updateMutation = useUpdateApiCost();
  const deleteMutation = useDeleteApiCost();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const costData = {
      provider: formData.get("provider") as string,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      credits_used: formData.get("credits_used") ? parseInt(formData.get("credits_used") as string) : undefined,
      date: formData.get("date") as string,
      description: formData.get("description") as string || undefined,
      job_id: formData.get("job_id") as string || undefined,
      order_id: formData.get("order_id") as string || undefined,
    };
    try {
      if (editingCost) {
        await updateMutation.mutateAsync({ id: editingCost.id, ...costData });
      } else {
        await createMutation.mutateAsync(costData as any);
      }
      setIsDialogOpen(false);
      setEditingCost(null);
    } catch (error) {
      void error;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Despesas de API</h2>
          <p className="text-muted-foreground">Registre despesas diárias com APIs (Suno, OpenAI, etc.)</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCost(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Despesa</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCost ? "Editar" : "Nova"} Despesa de API</DialogTitle>
              <DialogDescription>Registre gastos com APIs e, se necessário, vincule ao pedido.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="provider">Provider *</Label>
                  <Select name="provider" defaultValue={editingCost?.provider || "suno"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suno">Suno</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="date">Data *</Label><Input id="date" name="date" type="date" required defaultValue={editingCost?.date ? format(new Date(editingCost.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingCost ? editingCost.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="credits_used">Créditos Usados</Label><Input id="credits_used" name="credits_used" type="number" defaultValue={editingCost?.credits_used?.toString() || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="job_id">Job ID</Label><Input id="job_id" name="job_id" defaultValue={editingCost?.job_id || ""} /></div>
                <div><Label htmlFor="order_id">Order ID</Label><Input id="order_id" name="order_id" defaultValue={editingCost?.order_id || ""} /></div>
              </div>
              <div><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" defaultValue={editingCost?.description || ""} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingCost(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingCost ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-center py-8">Carregando...</div> : costs && costs.length > 0 ? (
        <div className="grid gap-4">
          {costs.map((cost) => (
            <Card key={cost.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>{cost.provider.toUpperCase()}</CardTitle><p className="text-sm text-muted-foreground">{formatCurrency(cost.amount_cents)} • {format(new Date(cost.date), "dd/MM/yyyy")} {cost.credits_used ? `• ${cost.credits_used} créditos` : ""}</p></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingCost(cost); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(cost.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              {cost.description && <CardContent><p className="text-sm text-muted-foreground">{cost.description}</p></CardContent>}
            </Card>
          ))}
        </div>
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma despesa de API registrada</CardContent></Card>}
    </div>
  );
}


