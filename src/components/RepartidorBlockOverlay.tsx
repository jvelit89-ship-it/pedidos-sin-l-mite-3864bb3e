import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Lock,
  ShieldAlert,
  Truck
} from 'lucide-react';

const BLOCK_THRESHOLD_HOURS = 4;
const WARNING_THRESHOLD_HOURS = 2;
const WARNING_INTERVAL_MINUTES = 15;

interface OverdueOrder {
  id: string;
  customer_name: string;
  repartidor_name: string | null;
  total: number;
  updated_at: string;
  hoursOverdue: number;
}

export function RepartidorBlockOverlay() {
  const { user } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const { formatCurrency } = useSettings();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const lastWarningRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isRepartidor = user?.role === 'repartidor';
  const repartidorId = user?.repartidorId;

  // Find overdue delivery orders for this repartidor
  const overdueOrders: OverdueOrder[] = (() => {
    if (!isRepartidor || !repartidorId) return [];
    const now = Date.now();
    return orders
      .filter(o => 
        o.status === 'delivery' && 
        o.repartidor_id === repartidorId
      )
      .map(o => {
        const hoursOverdue = (now - new Date(o.updated_at).getTime()) / (1000 * 60 * 60);
        return {
          id: o.id,
          customer_name: o.customer_name,
          repartidor_name: o.repartidor_name,
          total: o.total,
          updated_at: o.updated_at,
          hoursOverdue,
        };
      })
      .filter(o => o.hoursOverdue >= WARNING_THRESHOLD_HOURS)
      .sort((a, b) => b.hoursOverdue - a.hoursOverdue);
  })();

  const blockedOrders = overdueOrders.filter(o => o.hoursOverdue >= BLOCK_THRESHOLD_HOURS);
  const isBlocked = blockedOrders.length > 0;
  const hasWarnings = overdueOrders.length > 0 && !isBlocked;

  // Play alarm sound
  const playAlarm = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Urgent alarm sound
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, ctx.currentTime + i * 0.3);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + i * 0.3 + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.3 + 0.3);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.3);
      }
    } catch (e) {
      console.log('Audio failed:', e);
    }
  }, []);

  // Warning system: every 15 minutes after 2 hours
  useEffect(() => {
    if (!isRepartidor || overdueOrders.length === 0) return;

    const checkAndWarn = () => {
      const now = Date.now();
      if (now - lastWarningRef.current >= WARNING_INTERVAL_MINUTES * 60 * 1000) {
        lastWarningRef.current = now;
        playAlarm();
        
        if (isBlocked) {
          toast.error(
            '🚫 SISTEMA BLOQUEADO',
            {
              description: `Tienes ${blockedOrders.length} entrega(s) sin marcar por más de ${BLOCK_THRESHOLD_HOURS} horas. Marca como ENTREGADO para desbloquear.`,
              duration: 15000,
            }
          );
        } else {
          toast.warning(
            '⚠️ MARCA TUS ENTREGAS',
            {
              description: `Tienes ${overdueOrders.length} entrega(s) pendientes por más de 2 horas. Si no las marcas, el sistema se bloqueará a las 4 horas.`,
              duration: 10000,
            }
          );
        }
      }
    };

    // Check immediately
    checkAndWarn();

    const intervalId = setInterval(checkAndWarn, 60 * 1000); // Check every minute
    return () => clearInterval(intervalId);
  }, [isRepartidor, overdueOrders.length, isBlocked, blockedOrders.length, playAlarm]);

  const handleMarkDelivered = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      await updateOrderStatus(orderId, 'delivered');
      toast.success('✅ Entrega marcada como completada');
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setMarkingId(null);
    }
  };

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Warning banner (2-4 hours)
  if (hasWarnings && !isBlocked) {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        className="bg-amber-500 text-white"
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <AlertTriangle className="w-5 h-5" />
          </motion.div>
          <div className="flex-1">
            <p className="font-bold text-sm">
              ⚠️ {overdueOrders.length} entrega(s) sin marcar — ¡Actualiza ahora!
            </p>
            <p className="text-xs opacity-90">
              El sistema se bloqueará si no marcas como entregado antes de {BLOCK_THRESHOLD_HOURS} horas
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full block overlay (4+ hours)
  if (!isBlocked) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] bg-background/98 backdrop-blur-sm flex flex-col"
      >
        {/* Header */}
        <div className="bg-destructive text-destructive-foreground p-4 flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Lock className="w-6 h-6" />
          </motion.div>
          <div>
            <p className="font-bold text-lg">SISTEMA BLOQUEADO</p>
            <p className="text-sm opacity-90">
              Marca todas tus entregas como completadas para desbloquear
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center py-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-4"
            >
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </motion.div>
            <h2 className="text-xl font-bold text-destructive mb-2">
              {blockedOrders.length} entrega(s) pendiente(s)
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Tienes pedidos en tránsito por más de {BLOCK_THRESHOLD_HOURS} horas sin marcar como entregados. 
              El sistema permanecerá bloqueado hasta que actualices el estado de todos los pedidos.
            </p>
          </div>

          {/* Orders to mark */}
          <div className="space-y-3 max-w-lg mx-auto">
            {overdueOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-xl border-2 border-destructive/30 bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{order.id.slice(0, 8)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(order.hoursOverdue)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Truck className="w-4 h-4" />
                  <span>{formatCurrency(order.total)}</span>
                </div>

                <Button
                  className="w-full gap-2 font-bold"
                  size="lg"
                  disabled={markingId === order.id}
                  onClick={() => handleMarkDelivered(order.id)}
                >
                  {markingId === order.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  MARCAR COMO ENTREGADO
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
