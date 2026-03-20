import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getBusinessDateKey, getTodayBusinessDateKey, getBusinessDayCutoff } from '@/lib/limaTime';
import { DailyClosingHistory } from './DailyClosingHistory';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Package, 
  Truck, 
  XCircle,
  TrendingUp,
  DollarSign,
  Timer,
  Award,
  ClipboardCheck,
  History,
  ShoppingCart,
  Wallet,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const WORK_START_HOUR = 7;
const WORK_END_HOUR = 19;

interface DailyStats {
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  distributorPrepayments: number;
  avgDeliveryTime: number;
  deliveryRate: number;
  topProducts: { name: string; quantity: number }[];
  topVendedor?: { name: string; orders: number };
  topRepartidor?: { name: string; deliveries: number };
}

export function DailyClosing() {
  const { orders, refetch } = useOrders();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [showAutoReminder, setShowAutoReminder] = useState(false);
  const [distributorPrepayments, setDistributorPrepayments] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isVendedor = user?.role === 'vendedor';
  const isRepartidor = user?.role === 'repartidor';

  // Fetch distributor prepayments
  const fetchDistributorPrepayments = async () => {
    const today = getTodayBusinessDateKey();
    
    const { data, error } = await supabase
      .from('distributor_credits')
      .select('amount_paid, purchase_date');
    
    if (error) {
      console.error('Error fetching distributor prepayments:', error);
      return;
    }

    // Filter by business day
    const todayPrepayments = (data || []).filter(credit => 
      getBusinessDateKey(credit.purchase_date) === today
    );

    const total = todayPrepayments.reduce((sum, c) => sum + Number(c.amount_paid), 0);
    setDistributorPrepayments(total);
  };

  // Fetch distributor prepayments for today
  useEffect(() => {
    fetchDistributorPrepayments();
    
    // Refetch every 30 seconds
    const interval = setInterval(fetchDistributorPrepayments, 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual recalculate function
  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await Promise.all([
        refetch(),
        fetchDistributorPrepayments()
      ]);
      toast.success('Cierre del día recalculado');
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error('Error al recalcular');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Check if it's closing time (7pm)
  useEffect(() => {
    const checkClosingTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      
      // Show reminder at 7pm
      if (hour === WORK_END_HOUR && minutes === 0) {
        setShowAutoReminder(true);
        setTimeout(() => setShowAutoReminder(false), 60000); // Hide after 1 minute
      }
    };

    // Check immediately and then every minute
    checkClosingTime();
    const interval = setInterval(checkClosingTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate today's statistics using delivery date
  const dailyStats = useMemo<DailyStats>(() => {
    // Get today's business day key and compare against each order's delivery date
    const today = getTodayBusinessDateKey();
    const todayOrders = orders.filter(o => {
      if (o.delivery_date) return o.delivery_date === today;
      return getBusinessDateKey(o.created_at) === today;
    });

    // Filter by role if needed
    let filteredOrders = todayOrders;
    if (isVendedor && user?.vendedorId) {
      filteredOrders = todayOrders.filter(o => o.vendedor_id === user.vendedorId);
    } else if (isRepartidor && user?.repartidorId) {
      filteredOrders = todayOrders.filter(o => o.repartidor_id === user.repartidorId);
    }

    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered');
    const pendingOrders = filteredOrders.filter(o => 
      o.status !== 'delivered' && o.status !== 'cancelled'
    );
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');

    // Calculate total revenue (excluding distributor prepaid pickups - they pay upfront)
    // Distributors use prepaid credits, so their delivery orders shouldn't count as daily revenue
    const totalRevenue = deliveredOrders
      .filter(o => o.customers?.customer_type !== 'distribuidor')
      .reduce((sum, o) => sum + o.total, 0);

    // Calculate average delivery time
    const deliveryTimes = deliveredOrders
      .filter(o => o.delivered_at)
      .map(o => {
        const created = new Date(o.created_at);
        const delivered = new Date(o.delivered_at!);
        
        // Adjust for work hours
        const workStart = new Date(created);
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        
        const effectiveStart = created < workStart ? workStart : created;
        return (delivered.getTime() - effectiveStart.getTime()) / (1000 * 60);
      })
      .filter(t => t > 0 && t < 480); // Filter outliers

    const avgDeliveryTime = deliveryTimes.length > 0 
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : 0;

    // Delivery rate
    const deliveryRate = filteredOrders.length > 0 
      ? Math.round((deliveredOrders.length / filteredOrders.length) * 100)
      : 0;

    // Top products
    const productCounts = new Map<string, number>();
    filteredOrders.forEach(order => {
      order.order_items?.forEach(item => {
        const current = productCounts.get(item.product_name) || 0;
        productCounts.set(item.product_name, current + item.quantity);
      });
    });
    const topProducts = Array.from(productCounts.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Top vendedor (only for admin)
    let topVendedor: { name: string; orders: number } | undefined;
    if (isAdmin) {
      const vendedorCounts = new Map<string, number>();
      todayOrders.forEach(order => {
        if (order.vendedor_name) {
          const current = vendedorCounts.get(order.vendedor_name) || 0;
          vendedorCounts.set(order.vendedor_name, current + 1);
        }
      });
      const topV = Array.from(vendedorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      if (topV) {
        topVendedor = { name: topV[0], orders: topV[1] };
      }
    }

    // Top repartidor (only for admin)
    let topRepartidor: { name: string; deliveries: number } | undefined;
    if (isAdmin) {
      const repartidorCounts = new Map<string, number>();
      deliveredOrders.forEach(order => {
        if (order.repartidor_name) {
          const current = repartidorCounts.get(order.repartidor_name) || 0;
          repartidorCounts.set(order.repartidor_name, current + 1);
        }
      });
      const topR = Array.from(repartidorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      if (topR) {
        topRepartidor = { name: topR[0], deliveries: topR[1] };
      }
    }

    return {
      totalOrders: filteredOrders.length,
      deliveredOrders: deliveredOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      distributorPrepayments,
      avgDeliveryTime,
      deliveryRate,
      topProducts,
      topVendedor,
      topRepartidor,
    };
  }, [orders, user, isAdmin, isVendedor, isRepartidor, distributorPrepayments]);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRoleTitle = () => {
    if (isAdmin) return 'Cierre Diario - General';
    if (isVendedor) return 'Mi Resumen del Día';
    if (isRepartidor) return 'Mis Entregas del Día';
    return 'Resumen Diario';
  };

  return (
    <>
      {/* Auto Reminder Modal */}
      <AnimatePresence>
        {showAutoReminder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowAutoReminder(false)}
          >
            <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
              <CardContent className="pt-6 text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  <Clock className="w-16 h-16 mx-auto mb-4 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold mb-2">¡Hora de Cierre!</h2>
                <p className="text-muted-foreground mb-4">
                  Son las 7:00 PM. Es momento de revisar el resumen del día.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowAutoReminder(false)}
                  >
                    Después
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      setShowAutoReminder(false);
                      setIsOpen(true);
                    }}
                  >
                    Ver Resumen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Closing Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Cierre del Día
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {getRoleTitle()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </p>
          </DialogHeader>

          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="today" className="gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Hoy
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="today" className="space-y-4 mt-4">
              {/* Recalculate Button */}
              {isAdmin && (
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRecalculate}
                    disabled={isRecalculating}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                    {isRecalculating ? 'Recalculando...' : 'Recalcular'}
                  </Button>
                </div>
              )}

              {/* Total Orders Banner */}
              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-8 h-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Pedidos ({getBusinessDayCutoff().hour}:{getBusinessDayCutoff().minute.toString().padStart(2, '0')} - {getBusinessDayCutoff().hour}:{getBusinessDayCutoff().minute.toString().padStart(2, '0')})</p>
                        <p className="text-3xl font-bold text-primary">{dailyStats.totalOrders}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {format(new Date(), 'dd/MM/yyyy')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Main KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-[hsl(var(--status-delivered-bg))]">
                  <CardContent className="p-3 text-center">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--status-delivered))]" />
                    <p className="text-2xl font-bold">{dailyStats.deliveredOrders}</p>
                    <p className="text-xs text-muted-foreground">Entregados</p>
                  </CardContent>
                </Card>
                <Card className="bg-[hsl(var(--status-pending-bg))]">
                  <CardContent className="p-3 text-center">
                    <Clock className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--status-pending))]" />
                    <p className="text-2xl font-bold">{dailyStats.pendingOrders}</p>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              {(isAdmin || isVendedor) && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {/* Total Revenue (including prepayments) */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[hsl(var(--status-delivered))]" />
                        <span className="text-sm font-medium">Ingresos del día</span>
                      </div>
                      <span className="text-2xl font-bold text-[hsl(var(--status-delivered))]">
                        {formatCurrency(dailyStats.totalRevenue + dailyStats.distributorPrepayments)}
                      </span>
                    </div>
                    
                    {/* Breakdown */}
                    <div className="text-sm space-y-1 pt-2 border-t">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Ventas regulares</span>
                        <span>{formatCurrency(dailyStats.totalRevenue)}</span>
                      </div>
                      {dailyStats.distributorPrepayments > 0 && (
                        <div className="flex items-center justify-between text-purple-600">
                          <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Prepagos distribuidores
                          </span>
                          <span className="font-medium">{formatCurrency(dailyStats.distributorPrepayments)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Metrics */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Métricas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tasa de entrega</span>
                    <Badge variant={dailyStats.deliveryRate >= 80 ? 'default' : 'secondary'}>
                      {dailyStats.deliveryRate}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tiempo promedio</span>
                    <Badge variant="outline">
                      <Timer className="w-3 h-3 mr-1" />
                      {dailyStats.avgDeliveryTime > 0 ? formatTime(dailyStats.avgDeliveryTime) : '--'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total pedidos</span>
                    <Badge variant="outline">
                      <Package className="w-3 h-3 mr-1" />
                      {dailyStats.totalOrders}
                    </Badge>
                  </div>
                  {dailyStats.cancelledOrders > 0 && (
                    <div className="flex items-center justify-between text-destructive">
                      <span className="text-sm">Cancelados</span>
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {dailyStats.cancelledOrders}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              {dailyStats.topProducts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Productos más vendidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dailyStats.topProducts.map((product, index) => (
                        <div key={product.name} className="flex items-center justify-between">
                          <span className="text-sm truncate flex-1">
                            {index + 1}. {product.name}
                          </span>
                          <Badge variant="secondary" className="ml-2">
                            x{product.quantity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Performers (Admin only) */}
              {isAdmin && (dailyStats.topVendedor || dailyStats.topRepartidor) && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      Destacados del día
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailyStats.topVendedor && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">🏆 Mejor vendedor</span>
                        <span className="font-medium">
                          {dailyStats.topVendedor.name} ({dailyStats.topVendedor.orders})
                        </span>
                      </div>
                    )}
                    {dailyStats.topRepartidor && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">🚀 Mejor repartidor</span>
                        <span className="font-medium">
                          {dailyStats.topRepartidor.name} ({dailyStats.topRepartidor.deliveries})
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Separator />

              <p className="text-center text-xs text-muted-foreground">
                Horario laboral: {WORK_START_HOUR}:00 - {WORK_END_HOUR}:00
              </p>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="history" className="mt-4">
                <DailyClosingHistory />
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
