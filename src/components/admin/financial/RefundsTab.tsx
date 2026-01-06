import { useState } from "react";
import { useRefunds, useCreateRefund, useUpdateRefund } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Loader2 } from "lucide-react";
import type { Refund } from "@/types/admin";
import { format } from "date-fns";
import { useOrders } from "@/hooks/useAdminData";

export function RefundsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRefund, setEditingRefund] = useState<Refund | null>(null);
  const { data: refunds, isLoading } = useRefunds();
  const { data: ordersData } = useOrders({});
  const orders = ordersData?.orders || [];
  const createMutation = useCreateRefund();
  const updateMutation = useUpdateRefund();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const refundData = {
      order_id: formData.get("order_id") as string,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      reason: formData.get("reason") as string || undefined,
      refund_date: formData.get("refund_date") as string,
      status: formData.get("status") as any,
      provider: formData.get("provider") as string,
      transaction_id: formData.get("transaction_id") as string || undefined,
    };
    try {
      if (editingRefund) {
        await updateMutation.mutateAsync({ id: editingRefund.id, ...refundData });
      } else {
        await createMutation.mutateAsync(refundData as any);
      }
      setIsDialogOpen(false);
      setEditingRefund(null);
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
          <h2 className="text-2xl font-bold">Reembolsos</h2>
          <p className="text-muted-foreground">Gerencie reembolsos de pedidos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingRefund(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Reembolso</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRefund ? "Editar" : "Novo"} Reembolso</DialogTitle>
              <DialogDescription>Registre um reembolso e vincule ao pedido.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label htmlFor="order_id">Pedido *</Label>
                <Select name="order_id" defaultValue={editingRefund?.order_id || ""}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{orders?.map((o) => <SelectItem key={o.id} value={o.id}>{o.customer_email} - {formatCurrency(o.amount_cents)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingRefund ? editingRefund.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="refund_date">Data *</Label><Input id="refund_date" name="refund_date" type="date" required defaultValue={editingRefund?.refund_date ? format(new Date(editingRefund.refund_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={editingRefund?.status || "pending"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="completed">Completo</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="provider">Provider *</Label>
                  <Select name="provider" defaultValue={editingRefund?.provider || "cakto"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cakto">Cakto</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label htmlFor="transaction_id">Transaction ID</Label><Input id="transaction_id" name="transaction_id" defaultValue={editingRefund?.transaction_id || ""} /></div>
              <div><Label htmlFor="reason">Motivo</Label><Textarea id="reason" name="reason" defaultValue={editingRefund?.reason || ""} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRefund(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingRefund ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-center py-8">Carregando...</div> : refunds && refunds.length > 0 ? (
        <div className="grid gap-4">
          {refunds.map((refund) => (
            <Card key={refund.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Reembolso #{refund.id.slice(0, 8)}</CardTitle><p className="text-sm text-muted-foreground">{formatCurrency(refund.amount_cents)} • {format(new Date(refund.refund_date), "dd/MM/yyyy")} • {refund.status} • {refund.provider}</p></div>
                  <Button variant="outline" size="sm" onClick={() => { setEditingRefund(refund); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              {refund.reason && <CardContent><p className="text-sm text-muted-foreground">{refund.reason}</p></CardContent>}
            </Card>
          ))}
        </div>
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum reembolso encontrado</CardContent></Card>}
    </div>
  );
}
