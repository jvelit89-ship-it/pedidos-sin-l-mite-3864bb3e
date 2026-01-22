import { useState } from 'react';
import { Package, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from '@/hooks/useSupabaseData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmptyContainer {
  id: string;
  customer_id: string;
  company_id: string;
  quantity: number;
  status: string;
  notes: string | null;
  registered_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  customers?: {
    name: string;
    phone: string | null;
  };
}

export function EmptyContainersPanel() {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<EmptyContainer | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Cast to any to bypass type checking for new table
  const untypedClient = supabase as any;
  
  const { data: containers, loading, refetch } = useRealtimeQuery<EmptyContainer>('distributor_empty_containers' as any, {
    select: '*, customers(name, phone)',
    filter: [{ column: 'status', value: 'pending' }],
    orderBy: { column: 'created_at', ascending: false },
  });

  const pendingContainers = containers || [];

  const handleReview = (container: EmptyContainer) => {
    setSelectedContainer(container);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const processReview = async (approved: boolean) => {
    if (!selectedContainer) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await untypedClient
        .from('distributor_empty_containers')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          review_notes: reviewNotes || null,
        })
        .eq('id', selectedContainer.id);

      if (error) throw error;

      toast.success(approved ? 'Bidones aprobados' : 'Bidones rechazados');
      setReviewDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error reviewing containers:', error);
      toast.error('Error al procesar');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (pendingContainers.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
            <Package className="w-5 h-5" />
            Bidones Pendientes de Aprobación
            <Badge variant="secondary" className="ml-auto bg-amber-200 text-amber-800">
              {pendingContainers.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {pendingContainers.map((container) => (
              <div key={container.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div>
                  <p className="font-medium">{container.customers?.name || 'Distribuidor'}</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{container.quantity}</strong> bidones vacíos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(container.registered_at), 'Pp', { locale: es })}
                  </p>
                  {container.notes && (
                    <p className="text-xs text-amber-700 mt-1">Nota: {container.notes}</p>
                  )}
                </div>
                <Button size="sm" onClick={() => handleReview(container)}>
                  Revisar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Bidones Vacíos</DialogTitle>
          </DialogHeader>
          
          {selectedContainer && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Distribuidor:</strong> {selectedContainer.customers?.name}</p>
                <p><strong>Cantidad:</strong> {selectedContainer.quantity} bidones</p>
                <p><strong>Fecha:</strong> {format(new Date(selectedContainer.registered_at), 'PPp', { locale: es })}</p>
                {selectedContainer.notes && (
                  <p><strong>Notas del distribuidor:</strong> {selectedContainer.notes}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes">Notas de revisión (opcional)</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Agregar comentarios..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => processReview(false)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Rechazar
            </Button>
            <Button
              onClick={() => processReview(true)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
