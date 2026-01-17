import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useOrders } from '@/hooks/useOrders';
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { 
  Truck, 
  MapPin,
  CheckCircle2,
  Package,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DeliveriesPage() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { orders, loading, updateOrderStatus } = useOrders();

  const deliveries = useMemo(() => {
    let filtered = orders.filter(o => 
      ['ready', 'delivery', 'delivered'].includes(o.status)
    );
    
    // For repartidor, only show their assigned deliveries
    if (user?.role === 'repartidor') {
      filtered = filtered.filter(o => o.repartidor_id === user.id);
    }
    
    // Sort: active first, then by date
    return filtered.sort((a, b) => {
      if (a.status === 'delivered' && b.status !== 'delivered') return 1;
      if (a.status !== 'delivered' && b.status === 'delivered') return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, user]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      
      toast.success(
        newStatus === 'delivered' ? '¡Entrega completada!' : 'Estado actualizado',
        { description: ORDER_STATUS_CONFIG[newStatus].label }
      );
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const activeDeliveries = deliveries.filter(d => d.status !== 'delivered');
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entregas</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <SyncIndicator />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">No hay entregas asignadas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Deliveries */}
          {activeDeliveries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-status-delivery" />
                Entregas Activas ({activeDeliveries.length})
              </h2>
              <div className="space-y-3">
                {activeDeliveries.map((delivery, index) => (
                  <motion.div
                    key={delivery.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="card-interactive">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{delivery.customer_name}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              #{delivery.id.slice(0, 8)}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${ORDER_STATUS_CONFIG[delivery.status].className}`}>
                            {ORDER_STATUS_CONFIG[delivery.status].icon} {ORDER_STATUS_CONFIG[delivery.status].label}
                          </span>
                        </div>

                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{delivery.delivery_address}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-lg">{formatCurrency(delivery.total)}</p>
                          
                          {delivery.status === 'ready' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(delivery.id, 'delivery')}
                              className="gap-2"
                            >
                              <Truck className="w-4 h-4" />
                              Iniciar Entrega
                            </Button>
                          )}
                          
                          {delivery.status === 'delivery' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(delivery.id, 'delivered')}
                              className="gap-2 bg-status-delivered hover:bg-status-delivered/90"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Marcar Entregado
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Deliveries */}
          {completedDeliveries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-delivered" />
                Completadas Hoy ({completedDeliveries.length})
              </h2>
              <div className="space-y-2">
                {completedDeliveries.slice(0, 5).map((delivery, index) => (
                  <motion.div
                    key={delivery.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="opacity-75">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{delivery.customer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Entregado {delivery.delivered_at && format(new Date(delivery.delivered_at), 'HH:mm')}
                            </p>
                          </div>
                          <span className="status-delivered px-2 py-0.5 rounded-full text-xs">
                            ✅ Entregado
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
