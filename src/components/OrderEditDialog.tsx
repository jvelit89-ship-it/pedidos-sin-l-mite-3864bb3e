import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeam } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    delivery_address: string | null;
    delivery_date: string | null;
    notes: string | null;
    repartidor_id: string | null;
    repartidor_name: string | null;
  };
  onSuccess: () => void;
}

export function OrderEditDialog({ open, onOpenChange, order, onSuccess }: OrderEditDialogProps) {
  const { repartidores, loading: loadingTeam } = useTeam();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [deliveryAddress, setDeliveryAddress] = useState(order.delivery_address || '');
  const [deliveryDate, setDeliveryDate] = useState(order.delivery_date || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [selectedRepartidorId, setSelectedRepartidorId] = useState(order.repartidor_id || '');

  const activeRepartidores = repartidores.filter(r => r.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRepartidorId) {
      toast.error('Repartidor requerido', {
        description: 'Debes asignar un repartidor para la entrega',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const repartidor = repartidores.find(r => r.id === selectedRepartidorId);
      
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_address: deliveryAddress,
          delivery_date: deliveryDate || null,
          notes: notes || null,
          repartidor_id: selectedRepartidorId,
          repartidor_name: repartidor?.name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Pedido actualizado');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar Pedido
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Dirección de Entrega</Label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Dirección completa"
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha de Entrega</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Repartidor *</Label>
            <Select value={selectedRepartidorId} onValueChange={setSelectedRepartidorId}>
              <SelectTrigger>
                <SelectValue placeholder="Asignar repartidor" />
              </SelectTrigger>
              <SelectContent>
                {activeRepartidores.map(repartidor => (
                  <SelectItem key={repartidor.id} value={repartidor.id}>
                    {repartidor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales de entrega..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || loadingTeam}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
