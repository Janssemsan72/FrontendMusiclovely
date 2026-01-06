import { useState } from "react";
import { useCaktoSales, useCreateCaktoSale, useUpdateCaktoSale, useDeleteCaktoSale } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { CaktoSalesSummary } from "@/types/admin";
import { format } from "date-fns";

export function CaktoSalesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<CaktoSalesSummary | null>(null);

  const { data: sales, isLoading } = useCaktoSales();
  const createMutation = useCreateCaktoSale();
  const updateMutation = useUpdateCaktoSale();
  const deleteMutation = useDeleteCaktoSale();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const saleData = {
      date: formData.get("date") as string,
      quantity: parseInt(formData.get("quantity") as string),
      product_value_cents: Math.round(parseFloat(formData.get("product_value") as string) * 100),
      fee_cents: Math.round(parseFloat(formData.get("fee") as string) * 100),
      notes: formData.get("notes") as string || undefined,
    };

    try {
      if (editingSale) {
        await updateMutation.mutateAsync({ id: editingSale.id, ...saleData });
      } else {
        await createMutation.mutateAsync(saleData as any);
      }
      setIsDialogOpen(false);
      setEditingSale(null);
      e.currentTarget.reset();
    } catch (error) {
      // Error já é tratado no hook
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
          <h2 className="text-2xl font-bold">Vendas Cakto</h2>
          <p className="text-muted-foreground">Registre vendas diárias da plataforma Cakto</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingSale(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSale ? "Editar" : "Nova"} Venda Cakto</DialogTitle>
              <DialogDescription>Registre o resumo diário de vendas e taxas da Cakto.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={editingSale?.date ? format(new Date(editingSale.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantidade de Vendas *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    required
                    min="0"
                    defaultValue={editingSale?.quantity || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="product_value">Valor do Produto (R$) *</Label>
                  <Input
                    id="product_value"
                    name="product_value"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingSale ? editingSale.product_value_cents / 100 : ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="fee">Taxa Cakto (R$) *</Label>
                <Input
                  id="fee"
                  name="fee"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editingSale ? editingSale.fee_cents / 100 : ""}
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingSale?.notes || ""}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingSale(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {editingSale ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : sales && sales.length > 0 ? (
        <div className="grid gap-4">
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{format(new Date(sale.date), "dd/MM/yyyy")}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {sale.quantity} venda(s) • Produto: {formatCurrency(sale.product_value_cents)} • Taxa: {formatCurrency(sale.fee_cents)}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      Total: {formatCurrency(sale.total_sales_cents)} • Taxas: {formatCurrency(sale.total_fees_cents)} • Líquido: {formatCurrency(sale.net_revenue_cents)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSale(sale);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja excluir esta venda?")) {
                          deleteMutation.mutate(sale.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {sale.notes && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{sale.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma venda registrada
          </CardContent>
        </Card>
      )}
    </div>
  );
}


