import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllItems, updateItem } from '@/lib/db';
import { Order, ORDER_STATUS_CONFIG } from '@/types';
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
  ExternalLink 
} from 'lucide-react';

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
function optimizeRoute(orders: Order[]): Order[] {
  if (orders.length <= 1) return orders;

  const ordersWithLocation = orders.filter(o => o.customerLatitude && o.customerLongitude);
  if (ordersWithLocation.length <= 1) return orders;

  const optimized: Order[] = [];
  const remaining = [...ordersWithLocation];

  // Start from first order
  optimized.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((order, idx) => {
      const dist = calculateDistance(
        last.customerLatitude!,
        last.customerLongitude!,
        order.customerLatitude!,
        order.customerLongitude!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    optimized.push(remaining.splice(nearestIdx, 1)[0]);
  }

  // Add back orders without location at the end
  const withoutLocation = orders.filter(o => !o.customerLatitude || !o.customerLongitude);
  return [...optimized, ...withoutLocation];
}

export default function RoutePage() {
  const { user } = useAuth();
  const { t, formatCurrency } = useSettings();
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [optimizedDeliveries, setOptimizedDeliveries] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDeliveries();
  }, [user]);

  const loadDeliveries = async () => {
    setIsLoading(true);
    let allOrders = await getAllItems('orders');

    // Filter to only assigned active deliveries
    if (user?.role === 'repartidor') {
      allOrders = allOrders.filter(o => o.repartidorId === user.id);
    }

    // Only ready and in-delivery orders
    allOrders = allOrders.filter(o => ['ready', 'delivery'].includes(o.status));

    setDeliveries(allOrders);
    setOptimizedDeliveries(optimizeRoute(allOrders));
    setIsLoading(false);
  };

  const handleOptimize = () => {
    const optimized = optimizeRoute(deliveries);
    setOptimizedDeliveries(optimized);
    toast.success('¡Ruta optimizada!');
  };

  const handleStatusUpdate = async (order: Order, newStatus: 'delivery' | 'delivered') => {
    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      syncStatus: navigator.onLine ? 'synced' : 'pending',
      ...(newStatus === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
    };

    await updateItem('orders', updatedOrder);
    await loadDeliveries();
    toast.success(newStatus === 'delivered' ? '¡Entrega completada!' : 'En camino');
  };

  const openNavigation = (order: Order) => {
    if (order.customerLatitude && order.customerLongitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${order.customerLatitude},${order.customerLongitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`,
        '_blank'
      );
    }
  };

  const routePoints = optimizedDeliveries
    .filter(o => o.customerLatitude && o.customerLongitude)
    .map(o => ({ lat: o.customerLatitude!, lng: o.customerLongitude! }));

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

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
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
                  .filter(o => o.customerLatitude && o.customerLongitude)
                  .map((o, idx) => ({
                    id: o.id,
                    lat: o.customerLatitude!,
                    lng: o.customerLongitude!,
                    label: `${idx + 1}. ${o.customerName}`,
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
                      <p className="font-semibold truncate">{order.customerName}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${ORDER_STATUS_CONFIG[order.status].className}`}>
                        {ORDER_STATUS_CONFIG[order.status].icon}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{order.deliveryAddress}</span>
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
                        onClick={() => handleStatusUpdate(order, 'delivery')}
                        className="gap-1"
                      >
                        <Truck className="w-4 h-4" />
                        <span className="hidden sm:inline">Iniciar</span>
                      </Button>
                    )}
                    {order.status === 'delivery' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(order, 'delivered')}
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
