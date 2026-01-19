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
  Calendar,
  TrendingUp,
  Package,
  Camera,
  ExternalLink,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Dashboard components
import { SmartAlerts } from '@/components/dashboard/SmartAlerts';
import { HealthIndicators } from '@/components/dashboard/HealthIndicators';
import { OperationalInsights } from '@/components/dashboard/OperationalInsights';
import { AllRepartidoresLoad } from '@/components/dashboard/RepartidorLoadSummary';
import { NewOrderBadge } from '@/components/dashboard/NewOrderBadge';
import { DailyClosing } from '@/components/dashboard/DailyClosing';
import { InvoiceRequestsPanel } from '@/components/dashboard/InvoiceRequestsPanel';

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

  const { settings } = useSettings();
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const hasDvrConfigured = settings.dvrSerialNumber || settings.dvrIpAddress;

  const handleCopySN = () => {
    if (settings.dvrSerialNumber) {
      navigator.clipboard.writeText(settings.dvrSerialNumber);
      toast.success('Número de serie copiado');
    }
  };

  const getDvrWebUrl = () => {
    if (settings.dvrIpAddress) {
      const port = settings.dvrPort || 80;
      return `http://${settings.dvrIpAddress}:${port}`;
    }
    return null;
  };

  const getDeepLink = () => {
    if (settings.dvrBrand === 'dahua') {
      return 'smartpss://';
    } else if (settings.dvrBrand === 'hikvision') {
      return 'ivms4200://';
    }
    return null;
  };

  const getAppName = () => {
    if (settings.dvrBrand === 'dahua') return 'SmartPSS / gDMSS';
    if (settings.dvrBrand === 'hikvision') return 'iVMS-4200 / IVMS';
    return 'App del fabricante';
  };

  const stats = useMemo<DashboardStats>(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.created_at.startsWith(today));
    
    return {
      ordersToday: todayOrders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inDeliveryOrders: orders.filter(o => o.status === 'delivery').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      
      const orderDate = new Date(order.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateFilter === 'today') {
        return orderDate >= today;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
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
          {isAdmin && hasDvrConfigured && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setIsCameraDialogOpen(true)}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Cámaras</span>
            </Button>
          )}
          <DailyClosing />
          <SyncIndicator />
        </div>
      </div>

      {/* Camera Dialog */}
      <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Videovigilancia - {settings.dvrBrand === 'dahua' ? 'Dahua' : settings.dvrBrand === 'hikvision' ? 'Hikvision' : 'DVR/NVR'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* If IP is configured, show iframe */}
            {settings.dvrIpAddress ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Acceso directo a la interfaz web del DVR/NVR:
                </p>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                  <iframe
                    src={getDvrWebUrl() || ''}
                    className="w-full h-full"
                    title="DVR/NVR Web Interface"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => window.open(getDvrWebUrl() || '', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir en nueva pestaña
                  </Button>
                </div>
              </div>
            ) : (
              /* If only SN is configured, show deep link options */
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Número de Serie (SN):</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded border text-sm font-mono">
                      {settings.dvrSerialNumber}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopySN}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Copia este número para usarlo en la aplicación de escritorio o móvil
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Abrir en aplicación:</p>
                  
                  {getDeepLink() && (
                    <Button 
                      className="w-full gap-2"
                      onClick={() => window.location.href = getDeepLink() || ''}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir {getAppName()}
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {settings.dvrBrand === 'dahua' && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://www.dahuasecurity.com/support/downloadCenter', '_blank')}
                        >
                          Descargar SmartPSS
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://play.google.com/store/apps/details?id=com.mm.android.DMSS', '_blank')}
                        >
                          gDMSS (Android)
                        </Button>
                      </>
                    )}
                    {settings.dvrBrand === 'hikvision' && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://www.hikvision.com/en/support/download/software/ivms4200-series/', '_blank')}
                        >
                          Descargar iVMS-4200
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => window.open('https://play.google.com/store/apps/details?id=com.hikvision.hikconnect', '_blank')}
                        >
                          Hik-Connect (Android)
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    💡 <strong>Tip:</strong> Para ver las cámaras directamente en el navegador, 
                    configura la IP del DVR en Ajustes → Videovigilancia
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

          {/* Invoice Requests Panel */}
          <InvoiceRequestsPanel />
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
