import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';
import { MapView } from '@/components/MapView';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { 
  Route, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Truck, 
  RefreshCw,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface DeliveryOrder {
  id: string;
  customer_name: string;
  delivery_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  total: number;
  status: 'pending' | 'preparation' | 'ready' | 'delivery' | 'delivered' | 'cancelled';
  repartidor_id: string | null;
}

const ORDER_STATUS_CONFIG: Record<string, { className: string; icon: string }> = {
  pending: { className: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  preparation: { className: 'bg-blue-100 text-blue-800', icon: '👨‍🍳' },
  ready: { className: 'bg-purple-100 text-purple-800', icon: '✅' },
  delivery: { className: 'bg-orange-100 text-orange-800', icon: '🚚' },
  delivered: { className: 'bg-green-100 text-green-800', icon: '✓' },
  cancelled: { className: 'bg-gray-100 text-gray-800', icon: '✗' },
};

// Simple distance calculation (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest neighbor route optimization
function optimizeRoute(orders: DeliveryOrder[]): DeliveryOrder[] {
  if (orders.length <= 1) return orders;

  const ordersWithLocation = orders.filter(o => o.customer_latitude && o.customer_longitude);
  if (ordersWithLocation.length <= 1) return orders;

  const optimized: DeliveryOrder[] = [];
  const remaining = [...ordersWithLocation];

  // Start from first order
  optimized.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((order, idx) => {
      const dist = calculateDistance(
        last.customer_latitude!,
        last.customer_longitude!,
        order.customer_latitude!,
        order.customer_longitude!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    optimized.push(remaining.splice(nearestIdx, 1)[0]);
  }

  // Add back orders without location at the end
  const withoutLocation = orders.filter(o => !o.customer_latitude || !o.customer_longitude);
  return [...optimized, ...withoutLocation];
}

export default function RoutePage() {
  const { user } = useAuth();
  const { t, formatCurrency } = useSettings();
  const { orders, loading, updateOrderStatus } = useOrders();
  const [optimizedDeliveries, setOptimizedDeliveries] = useState<DeliveryOrder[]>([]);

  // Filter to only ready and in-delivery orders for repartidores
  const deliveries = orders.filter(o => {
    if (!['ready', 'delivery'].includes(o.status)) return false;
    if (user?.role === 'repartidor' && user.repartidorId && o.repartidor_id !== user.repartidorId) return false;
    return true;
  }) as DeliveryOrder[];

  useEffect(() => {
    setOptimizedDeliveries(optimizeRoute(deliveries));
  }, [orders]);

  const handleOptimize = () => {
    const optimized = optimizeRoute(deliveries);
    setOptimizedDeliveries(optimized);
    toast.success('¡Ruta optimizada!');
  };

  const handleStatusUpdate = async (orderId: string, newStatus: 'delivery' | 'delivered') => {
    await updateOrderStatus(orderId, newStatus);
    toast.success(newStatus === 'delivered' ? '¡Entrega completada!' : 'En camino');
  };

  const openNavigation = (order: DeliveryOrder) => {
    if (order.customer_latitude && order.customer_longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${order.customer_latitude},${order.customer_longitude}`,
        '_blank'
      );
    } else if (order.delivery_address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
        '_blank'
      );
    }
  };

  const routePoints = optimizedDeliveries
    .filter(o => o.customer_latitude && o.customer_longitude)
    .map(o => ({ lat: o.customer_latitude!, lng: o.customer_longitude! }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Route className="w-6 h-6" /> {t.route}
        </h1>
        <Button onClick={handleOptimize} className="gap-2">
          <RefreshCw className="w-4 h-4" /> {t.optimizeRoute}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      ) : optimizedDeliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Route className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay entregas pendientes</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Map with route */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapa de Ruta</CardTitle>
            </CardHeader>
            <CardContent>
              <MapView
                showRoute={true}
                routePoints={routePoints}
                markers={optimizedDeliveries
                  .filter(o => o.customer_latitude && o.customer_longitude)
                  .map((o, idx) => ({
                    id: o.id,
                    lat: o.customer_latitude!,
                    lng: o.customer_longitude!,
                    label: `${idx + 1}. ${o.customer_name}`,
                  }))}
                height="350px"
              />
            </CardContent>
          </Card>

          {/* Ordered delivery list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Paradas ({optimizedDeliveries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {optimizedDeliveries.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{order.customer_name}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${ORDER_STATUS_CONFIG[order.status].className}`}>
                        {ORDER_STATUS_CONFIG[order.status].icon}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{order.delivery_address || 'Sin dirección'}</span>
                    </p>
                    <p className="text-sm font-medium mt-1">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openNavigation(order)}
                    >
                      <Navigation className="w-4 h-4" />
                      <span className="hidden sm:inline">Navegar</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    {order.status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(order.id, 'delivery')}
                        className="gap-1"
                      >
                        <Truck className="w-4 h-4" />
                        <span className="hidden sm:inline">Iniciar</span>
                      </Button>
                    )}
                    {order.status === 'delivery' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(order.id, 'delivered')}
                        className="gap-1 bg-status-delivered hover:bg-status-delivered/90"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Entregado</span>
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
