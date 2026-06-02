import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePendingProduction } from '@/hooks/usePendingProduction';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X, Clock, Trash2, Package, AlertTriangle, Edit3, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export function PendingProductionPanel() {
  const { 
    pendingItems, 
    loading, 
    approveProduction, 
    rejectProduction, 
    requestCorrection, 
    updatePending,
    deletePending 
  } = usePendingProduction();
  const { products, refetch: refetchProducts } = useProducts();
  const { user, isAdmin } = useAuth();
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Edit state for operarios
  const [editQuantity, setEditQuantity] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  const isOperario = user?.role === 'operario';

  const visibleItems = pendingItems.filter((p: any) => {
    if (isAdmin) {
      // Admins see everything that is pending or requested for correction
      return p.status === 'pending' || p.status === 'correction_requested';
    } else if (isOperario) {
      // Operarios see their own items that are pending or need correction
      return p.requested_by === user?.id && (p.status === 'pending' || p.status === 'correction_requested');
    }
    return false;
  });

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

  const handleOpenCorrection = (id: string) => {
    setSelectedId(id);
    setCorrectionNote('');
    setCorrectionDialogOpen(true);
  };

  const handleRequestCorrection = async () => {
    if (!selectedId || !correctionNote) {
      toast.error('Por favor ingresa una observación');
      return;
    }
    setProcessing(selectedId);
    await requestCorrection(selectedId, correctionNote);
    setCorrectionDialogOpen(false);
    setSelectedId(null);
    setProcessing(null);
  };

  const handleOpenEdit = (item: any) => {
    setSelectedId(item.id);
    setEditQuantity(item.quantity);
    setEditNotes(item.notes || '');
    setEditDialogOpen(true);
  };

  const handleUpdatePending = async () => {
    if (!selectedId || editQuantity <= 0) {
      toast.error('Cantidad inválida');
      return;
    }
    setProcessing(selectedId);
    await updatePending(selectedId, {
      quantity: editQuantity,
      notes: editNotes
    });
    setEditDialogOpen(false);
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

  if (visibleItems.length === 0) {
    if (isOperario) return null; // Don't show empty panel to operarios if they have no requests
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
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
            <Clock className={`h-5 w-5 ${visibleItems.some((i: any) => i.status === 'pending') ? 'text-amber-500' : 'text-blue-500'}`} />
            {isAdmin ? 'Control de Producción' : 'Mis Solicitudes de Producción'}
            <Badge variant="secondary" className="ml-2">{visibleItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleItems.map((item: any) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                item.status === 'correction_requested' 
                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' 
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{getProductName(item.product_id)}</span>
                  <Badge variant="outline" className={item.status === 'correction_requested' ? 'text-blue-600 border-blue-300' : 'text-amber-600 border-amber-300'}>
                    {item.quantity} unidades
                  </Badge>
                  {item.status === 'correction_requested' && (
                    <Badge className="bg-blue-600">Corrección Requerida</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isAdmin ? (
                    <>Solicitado por: <span className="font-medium">{item.requested_by_name || 'Operario'}</span></>
                  ) : (
                    <span className="capitalize">{item.status === 'pending' ? 'Pendiente' : 'Corregir'}</span>
                  )}
                  {' • '}
                  {format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}
                </div>
                {item.notes && (
                  <div className="text-sm text-muted-foreground mt-1 italic">
                    Nota: {item.notes}
                  </div>
                )}
                {item.review_notes && (
                  <div className="text-sm text-blue-700 dark:text-blue-300 mt-2 p-2 bg-blue-100/50 dark:bg-blue-900/30 rounded border border-blue-200/50 flex gap-2 items-start">
                    <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                    <span><strong>Obs. Admin:</strong> {item.review_notes}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
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
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handleOpenCorrection(item.id)}
                      disabled={processing === item.id}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Solicitar Corrección
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
                  </>
                )}
                
                {isOperario && item.status === 'correction_requested' && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleOpenEdit(item)}
                    disabled={processing === item.id}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Corregir y Reenviar
                  </Button>
                )}

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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
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

      {/* Correction Dialog (for Admin) */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <MessageSquare className="h-5 w-5" />
              Solicitar Corrección
            </DialogTitle>
            <DialogDescription>
              Explica al operario qué debe corregir en este registro.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Ej: La cantidad no coincide con el lote..."
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRequestCorrection}>
              Enviar Observación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (for Operario) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Corregir Registro de Producción
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad</label>
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas</label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUpdatePending}>
              Guardar y Reenviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
