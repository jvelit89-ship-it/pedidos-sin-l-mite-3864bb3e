import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useOrders } from '@/hooks/useOrders';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAuth } from '@/contexts/AuthContext';
import { ORDER_STATUS_CONFIG, DashboardStats } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { 
  ShoppingCart, 
  Clock, 
  Truck, 
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
  Package,
  Link,
  Copy,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBusinessDateKey, getTodayBusinessDateKey } from '@/lib/limaTime';
// Dashboard components
import { NewOrderBadge } from '@/components/dashboard/NewOrderBadge';

const DailyClosing = lazy(() => import('@/components/dashboard/DailyClosing').then((m) => ({ default: m.DailyClosing })));
const SmartAlerts = lazy(() => import('@/components/dashboard/SmartAlerts').then((m) => ({ default: m.SmartAlerts })));
const HealthIndicators = lazy(() => import('@/components/dashboard/HealthIndicators').then((m) => ({ default: m.HealthIndicators })));
const OperationalInsights = lazy(() => import('@/components/dashboard/OperationalInsights').then((m) => ({ default: m.OperationalInsights })));
const AllRepartidoresLoad = lazy(() => import('@/components/dashboard/RepartidorLoadSummary').then((m) => ({ default: m.AllRepartidoresLoad })));
const InvoiceRequestsPanel = lazy(() => import('@/components/dashboard/InvoiceRequestsPanel').then((m) => ({ default: m.InvoiceRequestsPanel })));
const PendingProductionPanel = lazy(() => import('@/components/PendingProductionPanel').then((m) => ({ default: m.PendingProductionPanel })));
const EmptyContainersPanel = lazy(() => import('@/components/dashboard/EmptyContainersPanel').then((m) => ({ default: m.EmptyContainersPanel })));
const StuckDeliveriesPanel = lazy(() => import('@/components/dashboard/StuckDeliveriesPanel').then((m) => ({ default: m.StuckDeliveriesPanel })));
const LowStockAlert = lazy(() => import('@/components/dashboard/LowStockAlert').then((m) => ({ default: m.LowStockAlert })));
const DeliveryGeostatistics = lazy(() => import('@/components/dashboard/DeliveryGeostatistics').then((m) => ({ default: m.DeliveryGeostatistics })));
const SuspiciousDeliveriesPanel = lazy(() => import('@/components/dashboard/SuspiciousDeliveriesPanel').then((m) => ({ default: m.SuspiciousDeliveriesPanel })));
const WeeklySalesChart = lazy(() => import('@/components/dashboard/WeeklySalesChart').then((m) => ({ default: m.WeeklySalesChart })));
const CustomerFollowUpPanel = lazy(() => import('@/components/dashboard/CustomerFollowUpPanel').then((m) => ({ default: m.CustomerFollowUpPanel })));
const SellerDeliveryReviewPanel = lazy(() => import('@/components/dashboard/SellerDeliveryReviewPanel').then((m) => ({ default: m.SellerDeliveryReviewPanel })));
const SuperadminVehicleTracker = lazy(() => import('@/components/dashboard/SuperadminVehicleTracker').then((m) => ({ default: m.SuperadminVehicleTracker })));

const DashboardModuleFallback = () => (
  <Card>
    <CardContent className="p-4">
      <div className="h-20 animate-pulse rounded-lg bg-muted/60" />
    </CardContent>
  </Card>
);


export default function DashboardPage() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadSecondaryModules, setLoadSecondaryModules] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(() => setLoadSecondaryModules(true), { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timeoutId = window.setTimeout(() => setLoadSecondaryModules(true), 350);
    return () => window.clearTimeout(timeoutId);
  }, []);
  const { orders, loading, refetch, updateOrderStatus } = useOrders({
    mode: 'dashboard',
    dashboardDateFilter: dateFilter,
  });

  const {
    smartAlerts,
    healthIndicators,
    operationalInsights,
    allRepartidoresLoad,
    newOrdersCount,
    ALERT_THRESHOLD_MINUTES,
  } = useDashboardStats(orders);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isVendedor = user?.role === 'vendedor';
  const isSuperadmin = user?.role === 'superadmin' || user?.email?.toLowerCase() === 'jvelit89@gmail.com';

  const stats = useMemo<DashboardStats>(() => {
    const today = getTodayBusinessDateKey();
    const todayOrders = orders.filter(o => {
      // Delivered/cancelled orders: group by delivered_at date if available
      if (o.status === 'delivered' && o.delivered_at) {
        return getBusinessDateKey(o.delivered_at) === today;
      }
      // Active and other orders: group by created_at business day
      return getBusinessDateKey(o.created_at) === today;
    });

    return {
      ordersToday: todayOrders.length,
      pendingOrders: todayOrders.filter(o => o.status === 'pending').length,
      inDeliveryOrders: todayOrders.filter(o => o.status === 'delivery').length,
      cancelledOrders: todayOrders.filter(o => o.status === 'cancelled').length,
      deliveredOrders: todayOrders.filter(o => o.status === 'delivered').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const today = getTodayBusinessDateKey();
    const weekAgo = getBusinessDateKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // Delivered orders: group by delivered_at; others: by created_at
      const orderDay = (order.status === 'delivered' && order.delivered_at)
        ? getBusinessDateKey(order.delivered_at)
        : getBusinessDateKey(order.created_at);

      if (dateFilter === 'today') {
        return orderDay === today;
      }

      if (dateFilter === 'week') {
        return orderDay >= weekAgo;
      }

      return true;
    });
  }, [orders, dateFilter, statusFilter]);

  const kpiCards = [
    { 
      title: 'Pedidos Hoy', 
      value: stats.ordersToday, 
      icon: ShoppingCart, 
      color: 'text-primary',
      bgColor: 'bg-primary/10' 
    },
    { 
      title: 'Pendientes', 
      value: stats.pendingOrders, 
      icon: Clock, 
      color: 'text-[hsl(var(--status-pending))]',
      bgColor: 'bg-[hsl(var(--status-pending-bg))]' 
    },
    { 
      title: 'En Camino', 
      value: stats.inDeliveryOrders, 
      icon: Truck, 
      color: 'text-[hsl(var(--status-delivery))]',
      bgColor: 'bg-[hsl(var(--status-delivery-bg))]' 
    },
    { 
      title: 'Cancelados', 
      value: stats.cancelledOrders, 
      icon: XCircle,
      color: 'text-[hsl(var(--status-cancelled))]',
      bgColor: 'bg-[hsl(var(--status-cancelled-bg))]' 
    },
    { 
      title: 'Entregados', 
      value: stats.deliveredOrders, 
      icon: CheckCircle2,
      color: 'text-[hsl(var(--status-delivered))]',
      bgColor: 'bg-[hsl(var(--status-delivered-bg))]' 
    },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <NewOrderBadge count={newOrdersCount} />
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="h-9 w-24 rounded-md bg-muted/60 animate-pulse" />}>
            <DailyClosing orders={orders} refetchOrders={refetch} />
          </Suspense>
          <SyncIndicator />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="card-interactive">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${kpi.bgColor}`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {(isSuperadmin || isVendedor) && loadSecondaryModules && (
        <Suspense fallback={<DashboardModuleFallback />}>
          <SuperadminVehicleTracker />
        </Suspense>
      )}

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* Public Portal Link */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                    <ExternalLink className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Portal de Pedidos Online</h3>
                    <p className="text-sm text-slate-500">Área de pedidos para Agua Santa Maria y Ecohielo.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button 
                    variant="default"
                    className="w-full md:w-auto gap-2"
                    onClick={() => window.open('https://pedidos.innsanma.com/pedidos-online', '_blank')}
                  >
                    Ir al Portal <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadSecondaryModules ? (
            <Suspense fallback={<DashboardModuleFallback />}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LowStockAlert />
                  <SmartAlerts alerts={smartAlerts} thresholdMinutes={ALERT_THRESHOLD_MINUTES} />
                  <HealthIndicators {...healthIndicators} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OperationalInsights insights={operationalInsights} />
                  <AllRepartidoresLoad loads={allRepartidoresLoad} />
                </div>

                <WeeklySalesChart />
                <CustomerFollowUpPanel />
                <DeliveryGeostatistics />
                <SuspiciousDeliveriesPanel />
                <StuckDeliveriesPanel orders={orders} updateOrderStatus={updateOrderStatus} />
                <InvoiceRequestsPanel />
                <EmptyContainersPanel />
              </div>
            </Suspense>
          ) : (
            <DashboardModuleFallback />
          )}
        </>
      )}

      {isVendedor && loadSecondaryModules && (
        <div className="space-y-6">
          <Suspense fallback={<DashboardModuleFallback />}>
            <SellerDeliveryReviewPanel orders={orders} onReviewed={refetch} />
          </Suspense>
          <Suspense fallback={<DashboardModuleFallback />}>
            <CustomerFollowUpPanel />
          </Suspense>
        </div>
      )}

      {/* Production Control Panel - Visible to Admins (all pending) and Operarios (their own pending/corrections) */}
      <Suspense fallback={<DashboardModuleFallback />}>
        <PendingProductionPanel />
      </Suspense>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Pedidos Recientes</h2>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay pedidos para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.slice(0, 10).map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{order.customer_name}</p>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ORDER_STATUS_CONFIG[order.status].className}`}>
                        {ORDER_STATUS_CONFIG[order.status].icon} {ORDER_STATUS_CONFIG[order.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(order.created_at), 'HH:mm')}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}