import { useState } from "react";
import { useFixedCosts, useCreateFixedCost, useUpdateFixedCost, useDeleteFixedCost, useFinancialCategories } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FixedCost } from "@/types/admin";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FixedCostsTab() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);

  const { data: costs, isLoading } = useFixedCosts({ month: selectedMonth, year: selectedYear });
  const { data: categories } = useFinancialCategories();
  const createMutation = useCreateFixedCost();
  const updateMutation = useUpdateFixedCost();
  const deleteMutation = useDeleteFixedCost();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const costData = {
      category_id: formData.get("category_id") as string || undefined,
      name: formData.get("name") as string,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      frequency: formData.get("frequency") as any,
      month: parseInt(formData.get("month") as string),
      year: parseInt(formData.get("year") as string),
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string || undefined,
      is_active: formData.get("is_active") === "true",
      notes: formData.get("notes") as string || undefined,
    };

    try {
      if (editingCost) {
        await updateMutation.mutateAsync({ id: editingCost.id, ...costData });
      } else {
        await createMutation.mutateAsync(costData as any);
      }
      setIsDialogOpen(false);
      setEditingCost(null);
      e.currentTarget.reset();
    } catch (error) {
      // Error já é tratado no hook
    }
  };

  const handleEdit = (cost: FixedCost) => {
    setEditingCost(cost);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este custo fixo?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custos Fixos</h2>
          <p className="text-muted-foreground">Gerencie custos fixos recorrentes</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {format(new Date(2000, month - 1, 1), "MMMM", { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingCost(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Custo Fixo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCost ? "Editar" : "Novo"} Custo Fixo</DialogTitle>
                <DialogDescription>Cadastre custos recorrentes e gerencie vigência por mês/ano.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={editingCost?.name}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category_id">Categoria</Label>
                    <Select name="category_id" defaultValue={editingCost?.category_id || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                      defaultValue={editingCost ? editingCost.amount_cents / 100 : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frequência *</Label>
                    <Select name="frequency" defaultValue={editingCost?.frequency || "monthly"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="is_active">Status</Label>
                    <Select name="is_active" defaultValue={editingCost?.is_active ? "true" : "false"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Ativo</SelectItem>
                        <SelectItem value="false">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="month">Mês *</Label>
                    <Input
                      id="month"
                      name="month"
                      type="number"
                      min="1"
                      max="12"
                      required
                      defaultValue={editingCost?.month || selectedMonth}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Ano *</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      required
                      defaultValue={editingCost?.year || selectedYear}
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_date">Data Início *</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      required
                      defaultValue={editingCost?.start_date ? format(new Date(editingCost.start_date), "yyyy-MM-dd") : ""}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={editingCost?.end_date ? format(new Date(editingCost.end_date), "yyyy-MM-dd") : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingCost?.notes || ""}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingCost(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {editingCost ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : costs && costs.length > 0 ? (
        <div className="grid gap-4">
          {costs.map((cost) => (
            <Card key={cost.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{cost.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {cost.category?.name || "Sem categoria"} • {formatCurrency(cost.amount_cents)} / {cost.frequency === "monthly" ? "mês" : cost.frequency === "yearly" ? "ano" : cost.frequency === "weekly" ? "semana" : "dia"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(cost)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(cost.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {cost.notes && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{cost.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum custo fixo encontrado para este período
          </CardContent>
        </Card>
      )}
    </div>
  );
}
