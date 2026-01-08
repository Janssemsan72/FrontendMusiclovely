import { useState } from "react";
import { useAdjustments, useCreateAdjustment, useUpdateAdjustment } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Loader2 } from "lucide-react";
import type { Adjustment } from "@/types/admin";
import { format } from "date-fns";
import { useOrders } from "@/hooks/useAdminData";

export function AdjustmentsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null);
  const { data: adjustments, isLoading } = useAdjustments();
  const { data: ordersData } = useOrders({});
  const orders = ordersData?.orders || [];
  const createMutation = useCreateAdjustment();
  const updateMutation = useUpdateAdjustment();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const adjustmentData = {
      order_id: formData.get("order_id") as string,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      description: formData.get("description") as string || undefined,
      adjustment_date: formData.get("adjustment_date") as string,
      status: formData.get("status") as any,
      payment_method: formData.get("payment_method") as string,
      transaction_id: formData.get("transaction_id") as string || undefined,
    };
    try {
      if (editingAdjustment) {
        await updateMutation.mutateAsync({ id: editingAdjustment.id, ...adjustmentData });
      } else {
        await createMutation.mutateAsync(adjustmentData as any);
      }
      setIsDialogOpen(false);
      setEditingAdjustment(null);
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
          <h2 className="text-2xl font-bold">Ajustes</h2>
          <p className="text-muted-foreground">Gerencie ajustes cobrados aos clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingAdjustment(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Ajuste</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingAdjustment ? "Editar" : "Novo"} Ajuste</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label htmlFor="order_id">Pedido *</Label>
                <Select name="order_id" defaultValue={editingAdjustment?.order_id || ""}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{orders?.map((o) => <SelectItem key={o.id} value={o.id}>{o.customer_email} - {formatCurrency(o.amount_cents)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingAdjustment ? editingAdjustment.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="adjustment_date">Data *</Label><Input id="adjustment_date" name="adjustment_date" type="date" required defaultValue={editingAdjustment?.adjustment_date ? format(new Date(editingAdjustment.adjustment_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={editingAdjustment?.status || "pending"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="payment_method">Método de Pagamento *</Label>
                  <Select name="payment_method" defaultValue={editingAdjustment?.payment_method || "pix"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cakto">Cakto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label htmlFor="transaction_id">Transaction ID</Label><Input id="transaction_id" name="transaction_id" defaultValue={editingAdjustment?.transaction_id || ""} /></div>
              <div><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" defaultValue={editingAdjustment?.description || ""} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingAdjustment(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingAdjustment ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-center py-8">Carregando...</div> : adjustments && adjustments.length > 0 ? (
        <div className="grid gap-4">
          {adjustments.map((adjustment) => (
            <Card key={adjustment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Ajuste #{adjustment.id.slice(0, 8)}</CardTitle><p className="text-sm text-muted-foreground">{formatCurrency(adjustment.amount_cents)} • {format(new Date(adjustment.adjustment_date), "dd/MM/yyyy")} • {adjustment.status} • {adjustment.payment_method}</p></div>
                  <Button variant="outline" size="sm" onClick={() => { setEditingAdjustment(adjustment); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              {adjustment.description && <CardContent><p className="text-sm text-muted-foreground">{adjustment.description}</p></CardContent>}
            </Card>
          ))}
        </div>
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum ajuste encontrado</CardContent></Card>}
    </div>
  );
}
