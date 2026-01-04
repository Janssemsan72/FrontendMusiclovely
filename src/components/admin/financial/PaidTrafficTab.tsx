import { useState } from "react";
import { usePaidTraffic, useCreatePaidTraffic, useUpdatePaidTraffic, useDeletePaidTraffic } from "@/hooks/useFinancialData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { PaidTraffic } from "@/types/admin";
import { format } from "date-fns";

export function PaidTrafficTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTraffic, setEditingTraffic] = useState<PaidTraffic | null>(null);
  const { data: traffic, isLoading } = usePaidTraffic();
  const createMutation = useCreatePaidTraffic();
  const updateMutation = useUpdatePaidTraffic();
  const deleteMutation = useDeletePaidTraffic();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const trafficData = {
      platform: formData.get("platform") as string,
      campaign_name: formData.get("campaign_name") as string || undefined,
      amount_cents: Math.round(parseFloat(formData.get("amount") as string) * 100),
      date: formData.get("date") as string,
      impressions: formData.get("impressions") ? parseInt(formData.get("impressions") as string) : undefined,
      clicks: formData.get("clicks") ? parseInt(formData.get("clicks") as string) : undefined,
      conversions: formData.get("conversions") ? parseInt(formData.get("conversions") as string) : undefined,
      notes: formData.get("notes") as string || undefined,
    };
    try {
      if (editingTraffic) {
        await updateMutation.mutateAsync({ id: editingTraffic.id, ...trafficData });
      } else {
        await createMutation.mutateAsync(trafficData as any);
      }
      setIsDialogOpen(false);
      setEditingTraffic(null);
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
          <h2 className="text-2xl font-bold">Tráfego Pago</h2>
          <p className="text-muted-foreground">Registre tráfego pago diário (anúncios, marketing)</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingTraffic(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Registro</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingTraffic ? "Editar" : "Novo"} Tráfego Pago</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="platform">Plataforma *</Label>
                  <Select name="platform" defaultValue={editingTraffic?.platform || "google"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="date">Data *</Label><Input id="date" name="date" type="date" required defaultValue={editingTraffic?.date ? format(new Date(editingTraffic.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} /></div>
              </div>
              <div><Label htmlFor="campaign_name">Nome da Campanha</Label><Input id="campaign_name" name="campaign_name" defaultValue={editingTraffic?.campaign_name || ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="amount">Valor (R$) *</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingTraffic ? editingTraffic.amount_cents / 100 : ""} /></div>
                <div><Label htmlFor="impressions">Impressões</Label><Input id="impressions" name="impressions" type="number" defaultValue={editingTraffic?.impressions?.toString() || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="clicks">Cliques</Label><Input id="clicks" name="clicks" type="number" defaultValue={editingTraffic?.clicks?.toString() || ""} /></div>
                <div><Label htmlFor="conversions">Conversões</Label><Input id="conversions" name="conversions" type="number" defaultValue={editingTraffic?.conversions?.toString() || ""} /></div>
              </div>
              <div><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" defaultValue={editingTraffic?.notes || ""} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingTraffic(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingTraffic ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-center py-8">Carregando...</div> : traffic && traffic.length > 0 ? (
        <div className="grid gap-4">
          {traffic.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>{t.platform.toUpperCase()} {t.campaign_name ? `- ${t.campaign_name}` : ""}</CardTitle><p className="text-sm text-muted-foreground">{formatCurrency(t.amount_cents)} • {format(new Date(t.date), "dd/MM/yyyy")} {t.impressions ? `• ${t.impressions} impressões` : ""} {t.clicks ? `• ${t.clicks} cliques` : ""} {t.conversions ? `• ${t.conversions} conversões` : ""}</p></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingTraffic(t); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              {t.notes && <CardContent><p className="text-sm text-muted-foreground">{t.notes}</p></CardContent>}
            </Card>
          ))}
        </div>
      ) : <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum tráfego pago registrado</CardContent></Card>}
    </div>
  );
}


