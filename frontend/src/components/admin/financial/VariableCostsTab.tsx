import { useState } from "react";
import { useVariableCosts, useCreateVariableCost, useUpdateVariableCost, useDeleteVariableCost, useFinancialCategories } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { VariableCost } from "@/types/admin";
import { format } from "date-fns";

export function VariableCostsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<VariableCost | null>(null);
  const { data: costs, isLoading } = useVariableCosts();
  const { data: categories } = useFinancialCategories();
  const createMutation = useCreateVariableCost();
  const updateMutation = useUpdateVariableCost();
  const deleteMutation = useDeleteVariableCost();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const costData = {
      category_id: formData.get("category_id") as string || undefined,
      name: formData.get("name") as string,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      date: formData.get("date") as string,
      description: formData.get("description") as string || undefined,
      receipt_url: formData.get("receipt_url") as string || undefined,
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
          <h2 className="text-2xl font-bold">Custos Variáveis</h2>
          <p className="text-muted-foreground">Registre custos variáveis pontuais</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCost(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Custo</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingCost ? "Editar" : "Novo"} Custo Variável</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="name">Nome *</Label><Input id="name" name="name" required defaultValue={editingCost?.name} /></div>
                <div><Label htmlFor="category_id">Categoria</Label>
                  <Select name="category_id" defaultValue={editingCost?.category_id || ""}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{categories?.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingCost ? editingCost.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="date">Data *</Label><Input id="date" name="date" type="date" required defaultValue={editingCost?.date ? format(new Date(editingCost.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" defaultValue={editingCost?.description || ""} /></div>
              <div><Label htmlFor="receipt_url">URL do Comprovante</Label><Input id="receipt_url" name="receipt_url" type="url" defaultValue={editingCost?.receipt_url || ""} /></div>
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
                  <div><CardTitle>{cost.name}</CardTitle><p className="text-sm text-muted-foreground">{cost.category?.name || "Sem categoria"} • {formatCurrency(cost.amount_cents)} • {format(new Date(cost.date), "dd/MM/yyyy")}</p></div>
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
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum custo variável encontrado</CardContent></Card>}
    </div>
  );
}


