import { useState } from "react";
import { usePixSales, useCreatePixSale, useUpdatePixSale } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Loader2 } from "lucide-react";
import type { PixSale } from "@/types/admin";
import { format } from "date-fns";

export function PixSalesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<PixSale | null>(null);
  const { data: sales, isLoading } = usePixSales();
  const createMutation = useCreatePixSale();
  const updateMutation = useUpdatePixSale();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const saleData = {
      customer_name: formData.get("customer_name") as string,
      customer_email: formData.get("customer_email") as string || undefined,
      customer_whatsapp: formData.get("customer_whatsapp") as string || undefined,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      sale_date: formData.get("sale_date") as string,
      payment_date: formData.get("payment_date") as string || undefined,
      status: formData.get("status") as any,
      order_id: formData.get("order_id") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      receipt_url: formData.get("receipt_url") as string || undefined,
    };
    try {
      if (editingSale) {
        await updateMutation.mutateAsync({ id: editingSale.id, ...saleData });
      } else {
        await createMutation.mutateAsync(saleData as any);
      }
      setIsDialogOpen(false);
      setEditingSale(null);
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
          <h2 className="text-2xl font-bold">Vendas PIX</h2>
          <p className="text-muted-foreground">Registre vendas por PIX em outros locais</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSale(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Venda</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingSale ? "Editar" : "Nova"} Venda PIX</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label htmlFor="customer_name">Nome do Cliente *</Label><Input id="customer_name" name="customer_name" required defaultValue={editingSale?.customer_name} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="customer_email">Email</Label><Input id="customer_email" name="customer_email" type="email" defaultValue={editingSale?.customer_email || ""} /></div>
                <div><Label htmlFor="customer_whatsapp">WhatsApp</Label><Input id="customer_whatsapp" name="customer_whatsapp" defaultValue={editingSale?.customer_whatsapp || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingSale ? editingSale.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="sale_date">Data da Venda *</Label><Input id="sale_date" name="sale_date" type="date" required defaultValue={editingSale?.sale_date ? format(new Date(editingSale.sale_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="payment_date">Data do Pagamento</Label><Input id="payment_date" name="payment_date" type="date" defaultValue={editingSale?.payment_date ? format(new Date(editingSale.payment_date), "yyyy-MM-dd") : ""} /></div>
                <div><Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={editingSale?.status || "pending"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label htmlFor="order_id">Order ID (opcional)</Label><Input id="order_id" name="order_id" defaultValue={editingSale?.order_id || ""} /></div>
              <div><Label htmlFor="receipt_url">URL do Comprovante</Label><Input id="receipt_url" name="receipt_url" type="url" defaultValue={editingSale?.receipt_url || ""} /></div>
              <div><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" defaultValue={editingSale?.notes || ""} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingSale(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingSale ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-center py-8">Carregando...</div> : sales && sales.length > 0 ? (
        <div className="grid gap-4">
          {sales.map((sale) => (
            <Card key={sale.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>{sale.customer_name}</CardTitle><p className="text-sm text-muted-foreground">{formatCurrency(sale.amount_cents)} • {format(new Date(sale.sale_date), "dd/MM/yyyy")} • {sale.status}</p></div>
                  <Button variant="outline" size="sm" onClick={() => { setEditingSale(sale); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              {sale.notes && <CardContent><p className="text-sm text-muted-foreground">{sale.notes}</p></CardContent>}
            </Card>
          ))}
        </div>
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma venda PIX registrada</CardContent></Card>}
    </div>
  );
}


