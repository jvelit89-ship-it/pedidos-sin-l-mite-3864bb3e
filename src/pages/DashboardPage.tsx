import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useOrders } from '@/hooks/useOrders';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAuth } from '@/contexts/AuthContext';
import { ORDER_STATUS_CONFIG, DashboardStats } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useState } from 'react';
import { 
  ShoppingCart, 
  Clock, 
  Truck, 
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBusinessDateKey, getTodayBusinessDateKey } from '@/lib/limaTime';
// Dashboard components
import { SmartAlerts } from '@/components/dashboard/SmartAlerts';
import { HealthIndicators } from '@/components/dashboard/HealthIndicators';
import { OperationalInsights } from '@/components/dashboard/OperationalInsights';
import { AllRepartidoresLoad } from '@/components/dashboard/RepartidorLoadSummary';
import { NewOrderBadge } from '@/components/dashboard/NewOrderBadge';
import { DailyClosing } from '@/components/dashboard/DailyClosing';
import { InvoiceRequestsPanel } from '@/components/dashboard/InvoiceRequestsPanel';
import { PendingProductionPanel } from '@/components/PendingProductionPanel';
import { EmptyContainersPanel } from '@/components/dashboard/EmptyContainersPanel';
import { StuckDeliveriesPanel } from '@/components/dashboard/StuckDeliveriesPanel';

export default function DashboardPage() {
  const { orders, loading } = useOrders();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');

  const {
    smartAlerts,
    healthIndicators,
    operationalInsights,
    allRepartidoresLoad,
    newOrdersCount,
    ALERT_THRESHOLD_MINUTES,
  } = useDashboardStats();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const stats = useMemo<DashboardStats>(() => {
    const today = getTodayBusinessDateKey();
    const todayOrders = orders.filter(o => {
      // Use delivery_date if available, otherwise fall back to created_at business day
      if (o.delivery_date) return o.delivery_date === today;
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

      const orderDay = getBusinessDateKey(order.created_at);

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
          <DailyClosing />
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

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* Smart Alerts & Health Indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SmartAlerts alerts={smartAlerts} thresholdMinutes={ALERT_THRESHOLD_MINUTES} />
            <HealthIndicators {...healthIndicators} />
          </div>

          {/* Operational Insights & Load Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OperationalInsights insights={operationalInsights} />
            <AllRepartidoresLoad loads={allRepartidoresLoad} />
          </div>

          {/* Stuck Deliveries Panel */}
          <StuckDeliveriesPanel />

          {/* Invoice Requests Panel */}
          <InvoiceRequestsPanel />

          {/* Pending Production Panel */}
          <PendingProductionPanel />

          {/* Empty Containers Panel */}
          <EmptyContainersPanel />
        </>
      )}

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
