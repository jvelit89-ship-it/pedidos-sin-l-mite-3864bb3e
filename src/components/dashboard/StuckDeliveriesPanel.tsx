import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrders } from '@/hooks/useOrders';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  CheckCircle2, 
  MessageCircle, 
  Clock, 
  Truck,
  Phone
} from 'lucide-react';

const STUCK_THRESHOLD_MINUTES = 60; // Show after 1 hour in delivery

export function StuckDeliveriesPanel() {
  const { orders, updateOrderStatus } = useOrders();
  const { formatCurrency } = useSettings();

  const stuckDeliveries = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => {
        if (o.status !== 'delivery') return false;
        const updatedAt = new Date(o.updated_at).getTime();
        const minutesInDelivery = (now - updatedAt) / (1000 * 60);
        return minutesInDelivery >= STUCK_THRESHOLD_MINUTES;
      })
      .map(o => ({
        ...o,
        minutesStuck: Math.round((now - new Date(o.updated_at).getTime()) / (1000 * 60)),
      }))
      .sort((a, b) => b.minutesStuck - a.minutesStuck);
  }, [orders]);

  const handleForceDeliver = async (orderId: string, customerName: string) => {
    try {
      await updateOrderStatus(orderId, 'delivered', {
        notes: 'Marcado como entregado por admin (conductor no actualizó)',
      });
      toast.success(`Pedido de ${customerName} marcado como entregado`);
    } catch {
      toast.error('Error al actualizar pedido');
    }
  };

  const handleWhatsAppReminder = (repartidorName: string | null, customerName: string, orderId: string) => {
    // Build a WhatsApp message for the repartidor
    const message = encodeURIComponent(
      `⚠️ RECORDATORIO URGENTE\n\n` +
      `Hola ${repartidorName || 'repartidor'}, tienes un pedido pendiente de marcar como ENTREGADO:\n\n` +
      `📦 Cliente: ${customerName}\n` +
      `🔑 Pedido: #${orderId.slice(0, 8)}\n\n` +
      `Por favor, ingresa a la app y marca el pedido como entregado inmediatamente.\n\n` +
      `⏰ Si no lo haces, el sistema lo marcará automáticamente.`
    );
    // Open WhatsApp (without phone number, admin needs to select contact)
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (stuckDeliveries.length === 0) return null;

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getSeverity = (minutes: number) => {
    if (minutes >= 240) return 'destructive'; // 4+ hours - critical
    if (minutes >= 120) return 'default'; // 2+ hours - warning  
    return 'secondary'; // 1+ hour - attention
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AlertTriangle className="w-5 h-5" />
              </motion.div>
              Entregas Atascadas ({stuckDeliveries.length})
            </div>
            <Badge variant="destructive" className="text-xs">
              Acción requerida
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pedidos en tránsito por más de {STUCK_THRESHOLD_MINUTES} min sin marcar como entregado. 
            Después de 4 horas se marcarán automáticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {stuckDeliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-3 rounded-lg bg-background border border-destructive/20"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {delivery.customer_name}
                    </span>
                    <Badge variant={getSeverity(delivery.minutesStuck)} className="gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {formatTime(delivery.minutesStuck)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Truck className="w-3 h-3" />
                    <span>{delivery.repartidor_name || 'Sin repartidor'}</span>
                    <span>•</span>
                    <span>{formatCurrency(delivery.total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1 text-xs h-7"
                  onClick={() => handleForceDeliver(delivery.id, delivery.customer_name)}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Marcar Entregado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7 text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => handleWhatsAppReminder(
                    delivery.repartidor_name,
                    delivery.customer_name,
                    delivery.id
                  )}
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </Button>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
