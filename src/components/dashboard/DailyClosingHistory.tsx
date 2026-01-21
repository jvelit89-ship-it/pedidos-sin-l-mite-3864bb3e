import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders } from '@/hooks/useOrders';
import { useSettings } from '@/contexts/SettingsContext';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Package, 
  TrendingUp,
  DollarSign,
  Award,
  BarChart3,
  History
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface DayStats {
  date: Date;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  topProducts: { name: string; quantity: number }[];
  topVendedor?: { name: string; orders: number };
  topRepartidor?: { name: string; deliveries: number };
}

import { getBusinessDateKey, getTodayBusinessDateKey, getBusinessDayCutoff } from '@/lib/limaTime';

// Helper to check if a date is today (business day)
const isTodayBusinessDay = (date: Date): boolean => {
  const todayStr = getTodayBusinessDateKey();
  const dateStr = format(date, 'yyyy-MM-dd');
  return dateStr === todayStr;
};

export function DailyClosingHistory() {
  const { orders } = useOrders();
  const { formatCurrency } = useSettings();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Calculate stats for each day of the month
  const monthStats = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      // Convert order created_at to business day before comparing
      const dayOrders = orders.filter(o => getBusinessDateKey(o.created_at) === dayStr);
      
      const deliveredOrders = dayOrders.filter(o => o.status === 'delivered');
      const pendingOrders = dayOrders.filter(o => 
        o.status !== 'delivered' && o.status !== 'cancelled'
      );
      const cancelledOrders = dayOrders.filter(o => o.status === 'cancelled');
      // Exclude distributors from revenue (they use prepaid credits)
      const totalRevenue = deliveredOrders
        .filter(o => o.customers?.customer_type !== 'distribuidor')
        .reduce((sum, o) => sum + o.total, 0);

      // Top products
      const productCounts = new Map<string, number>();
      dayOrders.forEach(order => {
        order.order_items?.forEach(item => {
          const current = productCounts.get(item.product_name) || 0;
          productCounts.set(item.product_name, current + item.quantity);
        });
      });
      const topProducts = Array.from(productCounts.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Top vendedor
      const vendedorCounts = new Map<string, number>();
      dayOrders.forEach(order => {
        if (order.vendedor_name) {
          const current = vendedorCounts.get(order.vendedor_name) || 0;
          vendedorCounts.set(order.vendedor_name, current + 1);
        }
      });
      const topV = Array.from(vendedorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const topVendedor = topV ? { name: topV[0], orders: topV[1] } : undefined;

      // Top repartidor
      const repartidorCounts = new Map<string, number>();
      deliveredOrders.forEach(order => {
        if (order.repartidor_name) {
          const current = repartidorCounts.get(order.repartidor_name) || 0;
          repartidorCounts.set(order.repartidor_name, current + 1);
        }
      });
      const topR = Array.from(repartidorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const topRepartidor = topR ? { name: topR[0], deliveries: topR[1] } : undefined;

      return {
        date: day,
        totalOrders: dayOrders.length,
        deliveredOrders: deliveredOrders.length,
        pendingOrders: pendingOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalRevenue,
        topProducts,
        topVendedor,
        topRepartidor,
      };
    });
  }, [orders, selectedMonth]);

  // Summary for the month
  const monthSummary = useMemo(() => {
    const totalOrders = monthStats.reduce((sum, d) => sum + d.totalOrders, 0);
    const totalDelivered = monthStats.reduce((sum, d) => sum + d.deliveredOrders, 0);
    const totalRevenue = monthStats.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalCancelled = monthStats.reduce((sum, d) => sum + d.cancelledOrders, 0);
    
    // Best selling product of the month
    const productCounts = new Map<string, number>();
    monthStats.forEach(day => {
      day.topProducts.forEach(p => {
        const current = productCounts.get(p.name) || 0;
        productCounts.set(p.name, current + p.quantity);
      });
    });
    const bestProduct = Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    // Best vendedor of the month
    const vendedorCounts = new Map<string, number>();
    monthStats.forEach(day => {
      if (day.topVendedor) {
        const current = vendedorCounts.get(day.topVendedor.name) || 0;
        vendedorCounts.set(day.topVendedor.name, current + day.topVendedor.orders);
      }
    });
    const bestVendedor = Array.from(vendedorCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    // Best repartidor of the month
    const repartidorCounts = new Map<string, number>();
    monthStats.forEach(day => {
      if (day.topRepartidor) {
        const current = repartidorCounts.get(day.topRepartidor.name) || 0;
        repartidorCounts.set(day.topRepartidor.name, current + day.topRepartidor.deliveries);
      }
    });
    const bestRepartidor = Array.from(repartidorCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalOrders,
      totalDelivered,
      totalRevenue,
      totalCancelled,
      deliveryRate: totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0,
      bestProduct: bestProduct ? { name: bestProduct[0], quantity: bestProduct[1] } : null,
      bestVendedor: bestVendedor ? { name: bestVendedor[0], orders: bestVendedor[1] } : null,
      bestRepartidor: bestRepartidor ? { name: bestRepartidor[0], deliveries: bestRepartidor[1] } : null,
    };
  }, [monthStats]);

  const handleDayClick = (dayStats: DayStats) => {
    if (dayStats.totalOrders > 0) {
      setSelectedDay(dayStats);
      setIsDialogOpen(true);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const getDayColor = (dayStats: DayStats) => {
    if (dayStats.totalOrders === 0) return 'bg-muted/30';
    if (dayStats.deliveredOrders === dayStats.totalOrders && dayStats.totalOrders > 0) return 'bg-green-100 dark:bg-green-900/30';
    if (dayStats.pendingOrders > 0) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-blue-100 dark:bg-blue-900/30';
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Historial de Cierres</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium capitalize">
            {format(selectedMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigateMonth('next')}
            disabled={isSameMonth(selectedMonth, new Date())}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Month Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Resumen del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{monthSummary.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Total Pedidos</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{monthSummary.totalDelivered}</p>
              <p className="text-xs text-muted-foreground">Entregados</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(monthSummary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Ingresos</p>
            </div>
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{monthSummary.deliveryRate}%</p>
              <p className="text-xs text-muted-foreground">Tasa Entrega</p>
            </div>
          </div>

          {(monthSummary.bestProduct || monthSummary.bestVendedor || monthSummary.bestRepartidor) && (
            <>
              <Separator className="my-3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {monthSummary.bestProduct && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <Award className="w-4 h-4 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Más vendido</p>
                      <p className="text-sm font-medium truncate">{monthSummary.bestProduct.name}</p>
                      <p className="text-xs text-amber-600">x{monthSummary.bestProduct.quantity}</p>
                    </div>
                  </div>
                )}
                {monthSummary.bestVendedor && (
                  <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Award className="w-4 h-4 text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Mejor Vendedor</p>
                      <p className="text-sm font-medium truncate">{monthSummary.bestVendedor.name}</p>
                      <p className="text-xs text-purple-600">{monthSummary.bestVendedor.orders} pedidos</p>
                    </div>
                  </div>
                )}
                {monthSummary.bestRepartidor && (
                  <div className="flex items-center gap-2 p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                    <Award className="w-4 h-4 text-teal-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Mejor Repartidor</p>
                      <p className="text-sm font-medium truncate">{monthSummary.bestRepartidor.name}</p>
                      <p className="text-xs text-teal-600">{monthSummary.bestRepartidor.deliveries} entregas</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the start of the month */}
            {Array.from({ length: startOfMonth(selectedMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Day cells */}
            {monthStats.map((dayStats, index) => (
              <button
                key={index}
                onClick={() => handleDayClick(dayStats)}
                disabled={dayStats.totalOrders === 0}
                className={`aspect-square p-1 rounded-lg transition-all ${getDayColor(dayStats)} ${
                  dayStats.totalOrders > 0 ? 'hover:ring-2 hover:ring-primary cursor-pointer' : 'cursor-default'
                } ${isTodayBusinessDay(dayStats.date) ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="h-full flex flex-col items-center justify-center">
                  <span className={`text-xs ${isTodayBusinessDay(dayStats.date) ? 'font-bold' : ''}`}>
                    {format(dayStats.date, 'd')}
                  </span>
                  {dayStats.totalOrders > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayStats.totalOrders}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(selectedDay.date, "EEEE, d 'de' MMMM", { locale: es })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-green-50 dark:bg-green-900/20">
                    <CardContent className="p-3 text-center">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-600" />
                      <p className="text-2xl font-bold">{selectedDay.deliveredOrders}</p>
                      <p className="text-xs text-muted-foreground">Entregados</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-50 dark:bg-yellow-900/20">
                    <CardContent className="p-3 text-center">
                      <Clock className="w-6 h-6 mx-auto mb-1 text-yellow-600" />
                      <p className="text-2xl font-bold">{selectedDay.pendingOrders}</p>
                      <p className="text-xs text-muted-foreground">Pendientes</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-muted-foreground">Ingresos del día</span>
                      </div>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedDay.totalRevenue)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Métricas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total pedidos</span>
                      <Badge variant="outline">
                        <Package className="w-3 h-3 mr-1" />
                        {selectedDay.totalOrders}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tasa de entrega</span>
                      <Badge variant={selectedDay.totalOrders > 0 && selectedDay.deliveredOrders / selectedDay.totalOrders >= 0.8 ? 'default' : 'secondary'}>
                        {selectedDay.totalOrders > 0 
                          ? Math.round((selectedDay.deliveredOrders / selectedDay.totalOrders) * 100) 
                          : 0}%
                      </Badge>
                    </div>
                    {selectedDay.cancelledOrders > 0 && (
                      <div className="flex items-center justify-between text-destructive">
                        <span className="text-sm">Cancelados</span>
                        <Badge variant="destructive">{selectedDay.cancelledOrders}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Products */}
                {selectedDay.topProducts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Productos más vendidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedDay.topProducts.map((product, index) => (
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

                {/* Top Performers */}
                {(selectedDay.topVendedor || selectedDay.topRepartidor) && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        Destacados del día
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedDay.topVendedor && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">🏆 Mejor vendedor</span>
                          <span className="font-medium">
                            {selectedDay.topVendedor.name} ({selectedDay.topVendedor.orders})
                          </span>
                        </div>
                      )}
                      {selectedDay.topRepartidor && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">🚀 Mejor repartidor</span>
                          <span className="font-medium">
                            {selectedDay.topRepartidor.name} ({selectedDay.topRepartidor.deliveries})
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
