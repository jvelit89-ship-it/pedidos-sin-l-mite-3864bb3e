import { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useOrders } from '@/hooks/useOrders';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { RepartidorLoadSummary } from '@/components/dashboard/RepartidorLoadSummary';
import { DailyClosing } from '@/components/dashboard/DailyClosing';
import { 
  Truck, 
  MapPin,
  CheckCircle2,
  Package,
  Clock,
  Bell,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const URGENT_THRESHOLD_MINUTES = 90; // Alert when order is pending for 90+ minutes
const REMINDER_INTERVAL_MINUTES = 5; // Reminder bell every 5 minutes for unmarked deliveries

export default function DeliveriesPage() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { orders, loading, updateOrderStatus } = useOrders();
  const { getRepartidorLoad, newOrdersCount } = useDashboardStats();
  const [urgentAlerts, setUrgentAlerts] = useState<string[]>([]);
  const previousOrdersRef = useRef<string[]>([]);
  const initialLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isRepartidor = user?.role === 'repartidor';
  const repartidorId = user?.repartidorId;

  // Play bell sound
  const playBellSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Create a bell-like sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.1); // E6
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio playback failed:', e);
    }
  };

  const deliveries = useMemo(() => {
    let filtered = orders.filter(o => 
      ['ready', 'delivery', 'delivered'].includes(o.status)
    );
    
    // For repartidor, only show their assigned deliveries
    if (isRepartidor && repartidorId) {
      filtered = filtered.filter(o => o.repartidor_id === repartidorId);
    }
    
    // Sort: active first, then by date
    return filtered.sort((a, b) => {
      if (a.status === 'delivered' && b.status !== 'delivered') return 1;
      if (a.status !== 'delivered' && b.status === 'delivered') return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, isRepartidor, repartidorId]);

  // Calculate urgent orders (pending too long)
  const urgentOrders = useMemo(() => {
    const now = Date.now();
    return deliveries.filter(d => {
      if (d.status !== 'ready' && d.status !== 'delivery') return false;
      const createdAt = new Date(d.created_at).getTime();
      const minutesPending = (now - createdAt) / (1000 * 60);
      return minutesPending >= URGENT_THRESHOLD_MINUTES;
    });
  }, [deliveries]);

  // New order notification for repartidor
  useEffect(() => {
    if (!isRepartidor || initialLoadRef.current) {
      previousOrdersRef.current = deliveries.map(d => d.id);
      initialLoadRef.current = false;
      return;
    }

    const currentIds = deliveries.map(d => d.id);
    const newOrders = currentIds.filter(id => !previousOrdersRef.current.includes(id));

    if (newOrders.length > 0) {
      playBellSound();
      toast.success(`🔔 ${newOrders.length} nuevo(s) pedido(s) asignado(s)`, {
        description: 'Revisa tu lista de entregas',
        duration: 5000,
      });
    }

    previousOrdersRef.current = currentIds;
  }, [deliveries, isRepartidor]);

  // Update urgent alerts
  useEffect(() => {
    const newUrgentIds = urgentOrders.map(o => o.id);
    const newAlerts = newUrgentIds.filter(id => !urgentAlerts.includes(id));
    
    if (newAlerts.length > 0) {
      playBellSound();
      setUrgentAlerts(newUrgentIds);
    }
  }, [urgentOrders]);

  // Periodic reminder for unmarked "delivery" orders
  useEffect(() => {
    const pedidosEnCamino = deliveries.filter(d => d.status === 'delivery');
    
    // Only for repartidores with active "delivery" orders
    if (!isRepartidor || pedidosEnCamino.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const actuales = deliveries.filter(d => d.status === 'delivery');
      
      if (actuales.length > 0) {
        playBellSound();
        toast.warning(
          `⏰ Tienes ${actuales.length} entrega(s) en camino`,
          {
            description: '¿Ya las entregaste? Recuerda marcarlas',
            duration: 6000,
          }
        );
      }
    }, REMINDER_INTERVAL_MINUTES * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [deliveries, isRepartidor]);

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

  // Get load summary for current repartidor
  const repartidorLoad = useMemo(() => {
    if (!isRepartidor || !repartidorId) return null;
    return getRepartidorLoad(repartidorId);
  }, [isRepartidor, repartidorId, getRepartidorLoad]);

  // Calculate time since order was created
  const getTimeSinceCreation = (createdAt: string): string => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entregas</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          {isRepartidor && newOrdersCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Badge variant="destructive" className="gap-1">
                <Bell className="w-3 h-3" />
                {newOrdersCount} nuevo(s)
              </Badge>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DailyClosing />
          <SyncIndicator />
        </div>
      </div>

      {/* Repartidor Load Summary */}
      {isRepartidor && repartidorLoad && (
        <RepartidorLoadSummary load={repartidorLoad} />
      )}

      {/* Urgent Orders Alert */}
      {urgentOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="p-2 rounded-full bg-destructive/20"
                >
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </motion.div>
                <div>
                  <p className="font-semibold text-destructive">
                    ⚠️ {urgentOrders.length} pedido(s) urgente(s)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pendientes por más de {URGENT_THRESHOLD_MINUTES} minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                <Clock className="w-5 h-5 text-[hsl(var(--status-delivery))]" />
                Entregas Activas ({activeDeliveries.length})
              </h2>
              <div className="space-y-3">
                <AnimatePresence>
                  {activeDeliveries.map((delivery, index) => {
                    const isUrgent = urgentOrders.some(u => u.id === delivery.id);
                    const timeSince = getTimeSinceCreation(delivery.created_at);
                    
                    return (
                      <motion.div
                        key={delivery.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`card-interactive ${isUrgent ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{delivery.customer_name}</p>
                                  {isUrgent && (
                                    <motion.div
                                      animate={{ scale: [1, 1.1, 1] }}
                                      transition={{ duration: 0.5, repeat: Infinity }}
                                    >
                                      <Badge variant="destructive" className="gap-1 text-xs">
                                        <Timer className="w-3 h-3" />
                                        URGENTE
                                      </Badge>
                                    </motion.div>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  #{delivery.id.slice(0, 8)}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`px-3 py-1 text-xs rounded-full font-medium ${ORDER_STATUS_CONFIG[delivery.status].className}`}>
                                  {ORDER_STATUS_CONFIG[delivery.status].icon} {ORDER_STATUS_CONFIG[delivery.status].label}
                                </span>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                                  <Clock className="w-3 h-3" />
                                  {timeSince}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                              <span>{delivery.delivery_address || 'Sin dirección'}</span>
                            </div>

                            {/* Order items preview */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {delivery.order_items?.slice(0, 3).map((item, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {item.product_name.split(' ')[0]} x{item.quantity}
                                </Badge>
                              ))}
                              {(delivery.order_items?.length || 0) > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(delivery.order_items?.length || 0) - 3} más
                                </Badge>
                              )}
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
                                  className="gap-2 bg-[hsl(var(--status-delivered))] hover:bg-[hsl(var(--status-delivered))]/90"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Marcar Entregado
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Completed Deliveries */}
          {completedDeliveries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-delivered))]" />
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
