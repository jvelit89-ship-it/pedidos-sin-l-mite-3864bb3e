import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePendingProduction } from '@/hooks/usePendingProduction';
import { useProducts } from '@/hooks/useProducts';
import { Check, X, Clock, Trash2, Package, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function PendingProductionPanel() {
  const { pendingItems, loading, approveProduction, rejectProduction, deletePending } = usePendingProduction();
  const { products, refetch: refetchProducts } = useProducts();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const pendingOnly = pendingItems.filter((p: any) => p.status === 'pending');

  const getProductName = (productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    return product?.name || 'Producto desconocido';
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    await approveProduction(id);
    await refetchProducts();
    setProcessing(null);
  };

  const handleOpenReject = (id: string) => {
    setSelectedId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedId) return;
    setProcessing(selectedId);
    await rejectProduction(selectedId, rejectReason);
    setRejectDialogOpen(false);
    setSelectedId(null);
    setProcessing(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta solicitud de producción?')) {
      await deletePending(id);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Producción Pendiente de Aprobación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingOnly.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Producción Pendiente de Aprobación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No hay producción pendiente de aprobación</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Producción Pendiente de Aprobación
            <Badge variant="secondary" className="ml-2">{pendingOnly.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingOnly.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{getProductName(item.product_id)}</span>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {item.quantity} unidades
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Solicitado por: <span className="font-medium">{item.requested_by_name || 'Operario'}</span>
                  {' • '}
                  {format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}
                </div>
                {item.notes && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Nota: {item.notes}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleApprove(item.id)}
                  disabled={processing === item.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleOpenReject(item.id)}
                  disabled={processing === item.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                  disabled={processing === item.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Rechazar Producción
            </DialogTitle>
            <DialogDescription>
              Esta producción no será registrada. Puedes agregar una razón opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Razón del rechazo (opcional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Rechazar Producción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
