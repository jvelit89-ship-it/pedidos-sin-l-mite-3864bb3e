import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SyncIndicator } from '@/components/SyncIndicator';
import { DeleteOrdersDialog } from '@/components/DeleteOrdersDialog';
import { DailyClosing } from '@/components/dashboard/DailyClosing';
import { BusinessDaySelector } from '@/components/BusinessDaySelector';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useVendedores, useRepartidores } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types';
import { getTodayBusinessDateKey, getBusinessDateKey } from '@/lib/limaTime';
import { exportToPDF, exportToXLS, ExportOrder } from '@/lib/orderExport';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Filter,
  Package,
  ChevronRight,
  Loader2,
  Trash2,
  X,
  RefreshCw,
  User,
  Truck,
  FileSpreadsheet,
  Download,
  Flame,
  History,
  CheckCircle2,
  XCircle,
  FileText,
  MoreVertical,
  MessageSquare,
  Key
} from 'lucide-react';
import { RevealPinDialog } from '@/components/RevealPinDialog';
import { MarkDeliveredOTPDialog } from '@/components/MarkDeliveredOTPDialog';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  total: number;
  status: OrderStatus;
  vendedor_id: string | null;
  vendedor_name: string | null;
  repartidor_id: string | null;
  repartidor_name: string | null;
  delivery_date: string | null;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  delivery_pin: string | null;
  customers?: {
    customer_type: string | null;
    phone: string | null;
  };
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

// Active statuses (orders that need attention)
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'preparation', 'ready', 'delivery'];
// Completed statuses (history)
const COMPLETED_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, formatCurrency, t } = useSettings();
  const { orders, loading, refetch } = useOrders();
  const { vendedores } = useVendedores();
  const { repartidores } = useRepartidores();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'backorders'>('active');
  
  // History date filter (business day)
  const [historyDate, setHistoryDate] = useState(getTodayBusinessDateKey());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  
  // Selection
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteAll, setDeleteAll] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [revealPinOrderId, setRevealPinOrderId] = useState<string | null>(null);
  const [isRevealPinDialogOpen, setIsRevealPinDialogOpen] = useState(false);
  const [isMarkDeliveredOpen, setIsMarkDeliveredOpen] = useState(false);
  const [pendingDeliveredIds, setPendingDeliveredIds] = useState<string[]>([]);


  const locale = settings.language === 'es' ? es : enUS;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canCreateOrders = isAdmin || user?.role === 'vendedor';

  // Filter orders based on role
  const roleFilteredOrders = orders.filter((order: Order) => {
    if (user?.role === 'vendedor') {
      // For now, show all orders for vendedor until we link users to vendedores
      return true;
    }
    return true;
  });

  // Active orders: pending, preparation, ready, delivery (no date filter)
  const activeOrders = useMemo(() => {
    return roleFilteredOrders.filter((order: Order) => 
      ACTIVE_STATUSES.includes(order.status)
    );
  }, [roleFilteredOrders]);

  // History orders: delivered, cancelled (filtered by actual delivery/completion date)
  const historyOrders = useMemo(() => {
    return roleFilteredOrders.filter((order: Order) => {
      if (!COMPLETED_STATUSES.includes(order.status)) return false;
      
      // Delivered orders: use delivered_at date; cancelled/others: use created_at
      const orderDay = (order.status === 'delivered' && order.delivered_at)
        ? getBusinessDateKey(order.delivered_at)
        : getBusinessDateKey(order.created_at);
      return orderDay === historyDate;
    });
  }, [roleFilteredOrders, historyDate]);

  // Current tab orders
  const currentOrders = useMemo(() => {
    if (activeTab === 'active') return activeOrders;
    if (activeTab === 'backorders') return roleFilteredOrders.filter((o: Order) => o.status === 'backorder');
    return historyOrders;
  }, [activeTab, activeOrders, historyOrders, roleFilteredOrders]);

  // Apply search and filters to current orders
  const filteredOrders = useMemo(() => {
    return currentOrders.filter((order: Order) => {
      const matchesSearch = 
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter only applies within the tab's available statuses
      const availableStatuses = activeTab === 'active' ? ACTIVE_STATUSES 
        : activeTab === 'backorders' ? ['backorder' as OrderStatus]
        : COMPLETED_STATUSES;
      const matchesStatus = statusFilter === 'all' || 
        (availableStatuses.includes(statusFilter as OrderStatus) && order.status === statusFilter);
      
      const matchesVendedor = vendedorFilter === 'all' || order.vendedor_id === vendedorFilter;
      
      return matchesSearch && matchesStatus && matchesVendedor;
    });
  }, [currentOrders, searchTerm, statusFilter, vendedorFilter, activeTab]);

  // Reset status filter when changing tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'active' | 'history' | 'backorders');
    setStatusFilter('all');
    setSelectedOrders([]);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map((o: Order) => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleDeleteSelected = () => {
    setDeleteAll(false);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteAll = () => {
    setDeleteAll(true);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    setSelectedOrders([]);
    refetch();
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  // Bulk update handlers for admin
  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrders.length === 0) return;

    // Admin debe verificar con OTP para marcar como entregado
    if (newStatus === 'delivered' && isAdmin) {
      setPendingDeliveredIds([...selectedOrders]);
      setIsMarkDeliveredOpen(true);
      return;
    }



    
    setIsBulkUpdating(true);
    try {
      const updateData: { status: OrderStatus; updated_at: string; delivered_at?: string } = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .in('id', selectedOrders);

      if (error) throw error;

      toast.success(`${selectedOrders.length} pedido(s) actualizado(s) a "${ORDER_STATUS_CONFIG[newStatus].label}"`);
      setSelectedOrders([]);
      refetch();
    } catch (error) {
      console.error('Error bulk updating status:', error);
      toast.error('Error al actualizar estados');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleWhatsAppPIN = (order: Order) => {
    const phone = order.customers?.phone;
    if (!phone) {
      toast.error('El cliente no tiene un teléfono registrado');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
    
    let message = `*Pedido #${order.id.slice(0, 8)}*\n\nHola *${order.customer_name}*, su pedido está en proceso.`;
    
    if (order.delivery_pin) {
      message += `\n\n🔑 *Su PIN de entrega es: ${order.delivery_pin}*\nPor favor, entréguelo al repartidor al recibir su pedido.`;
    }
    
    message += `\n\n📍 Entrega en: ${order.delivery_address}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodedMessage}`, '_blank');
  };

  const handleBulkVendedorChange = async (vendedorId: string) => {
    if (selectedOrders.length === 0) return;
    
    const vendedor = vendedores.find(v => v.id === vendedorId);
    if (!vendedor) return;

    setIsBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          vendedor_id: vendedorId,
          vendedor_name: vendedor.name,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedOrders);

      if (error) throw error;

      toast.success(`${selectedOrders.length} pedido(s) asignado(s) a ${vendedor.name}`);
      setSelectedOrders([]);
      refetch();
    } catch (error) {
      console.error('Error bulk updating vendedor:', error);
      toast.error('Error al asignar vendedor');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkRepartidorChange = async (repartidorId: string) => {
    if (selectedOrders.length === 0) return;
    
    const repartidor = repartidores.find(r => r.id === repartidorId);
    if (!repartidor) return;

    // Check if this repartidor has overdue deliveries (1+ hour in transit)
    const overdueOrders = orders.filter(o => 
      o.status === 'delivery' && 
      o.repartidor_id === repartidorId &&
      (Date.now() - new Date(o.updated_at).getTime()) > 60 * 60 * 1000
    );

    if (overdueOrders.length > 0) {
      const proceed = window.confirm(
        `⚠️ ADVERTENCIA: ${repartidor.name} tiene ${overdueOrders.length} entrega(s) sin marcar como entregadas (más de 1 hora en tránsito).\n\n` +
        `¿Deseas asignar los pedidos de todas formas?`
      );
      if (!proceed) return;
    }

    setIsBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          repartidor_id: repartidorId,
          repartidor_name: repartidor.name,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedOrders);

      if (error) throw error;

      toast.success(`${selectedOrders.length} pedido(s) asignado(s) a ${repartidor.name}`);
      setSelectedOrders([]);
      refetch();
    } catch (error) {
      console.error('Error bulk updating repartidor:', error);
      toast.error('Error al asignar repartidor');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const activeVendedores = vendedores.filter(v => v.active);
  const activeRepartidores = repartidores.filter(r => r.active);

  // Status labels for export
  const statusLabels = Object.fromEntries(
    Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => [key, config.label])
  );

  // Export handlers
  const handleExport = (ordersToExport: Order[], fileName: string, type: 'pdf' | 'xls') => {
    if (ordersToExport.length === 0) {
      toast.error(settings.language === 'es' ? 'No hay pedidos para exportar' : 'No orders to export');
      return;
    }

    const exportOrders: ExportOrder[] = ordersToExport.map(o => ({
      id: o.id,
      customer_name: o.customer_name,
      status: o.status,
      total: o.total,
      vendedor_name: o.vendedor_name,
      repartidor_name: o.repartidor_name,
      delivery_address: o.delivery_address,
      created_at: o.created_at,
      delivered_at: o.delivered_at,
      order_items: o.order_items,
    }));

    const options = {
      orders: exportOrders,
      fileName,
      formatCurrency,
      statusLabels,
    };

    if (type === 'pdf') {
      exportToPDF(options);
      toast.success('Abriendo PDF para imprimir...');
    } else {
      exportToXLS(options);
      toast.success('Excel descargado');
    }
  };

  const handleExportFiltered = (type: 'pdf' | 'xls') => {
    handleExport(filteredOrders, 'pedidos_filtrados', type);
  };

  const handleExportByStatus = (status: OrderStatus, type: 'pdf' | 'xls') => {
    const statusOrders = currentOrders.filter((o: Order) => o.status === status);
    const statusName = ORDER_STATUS_CONFIG[status].label.toLowerCase().replace(/\s+/g, '_');
    handleExport(statusOrders, `pedidos_${statusName}`, type);
  };

  // Backorder orders
  const backorderOrders = useMemo(() => {
    return roleFilteredOrders.filter((order: Order) => order.status === 'backorder');
  }, [roleFilteredOrders]);

  const backorderCount = backorderOrders.length;

  // Count stats for tabs
  const activeCount = activeOrders.length;
  const historyCount = historyOrders.length;
  const deliveredCount = historyOrders.filter(o => o.status === 'delivered').length;
  const cancelledCount = historyOrders.filter(o => o.status === 'cancelled').length;

  // Status options based on current tab
  const statusOptions = activeTab === 'active' 
    ? ACTIVE_STATUSES 
    : activeTab === 'backorders'
      ? ['backorder' as OrderStatus]
      : COMPLETED_STATUSES;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.orders}</h1>
          <p className="text-muted-foreground">
            {format(new Date(), settings.language === 'es' ? "EEEE, d 'de' MMMM" : 'EEEE, MMMM d', { locale })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DailyClosing />
          <SyncIndicator />
          {isAdmin && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteAll}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {settings.language === 'es' ? 'Eliminar Todo' : 'Delete All'}
              </span>
            </Button>
          )}
          {canCreateOrders && (
            <Button onClick={() => navigate('/orders/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t.newOrder}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1.5 text-xs sm:text-sm">
            <Flame className="w-3.5 h-3.5" />
            Activos ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="backorders" className="gap-1.5 relative text-xs sm:text-sm">
            <span>⏳</span>
            Pre-pedidos
            {backorderCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold leading-none">
                {backorderCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <History className="w-3.5 h-3.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* History date selector */}
        {activeTab === 'history' && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <BusinessDaySelector 
                selectedDate={historyDate} 
                onDateChange={setHistoryDate} 
              />
              <div className="flex items-center gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {deliveredCount} entregados
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  {cancelledCount} cancelados
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection toolbar - shown when orders are selected */}
        {isAdmin && selectedOrders.length > 0 && (
          <Card className="border-primary bg-primary/5 mt-4">
            <CardContent className="p-3 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={clearSelection} disabled={isBulkUpdating}>
                    <X className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {selectedOrders.length} {settings.language === 'es' ? 'seleccionado(s)' : 'selected'}
                  </span>
                  {isBulkUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                </div>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2" disabled={isBulkUpdating}>
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {settings.language === 'es' ? 'Eliminar' : 'Delete'}
                  </span>
                </Button>
              </div>
              
              {/* Bulk actions row */}
              <div className="flex flex-wrap gap-2">
                {/* Bulk Status Change */}
                <Select onValueChange={(value) => handleBulkStatusChange(value as OrderStatus)} disabled={isBulkUpdating}>
                  <SelectTrigger className="w-auto min-w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <span className="text-sm">Cambiar estado</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk Vendedor Change */}
                <Select onValueChange={handleBulkVendedorChange} disabled={isBulkUpdating}>
                  <SelectTrigger className="w-auto min-w-[160px]">
                    <User className="w-4 h-4 mr-2" />
                    <span className="text-sm">Asignar vendedor</span>
                  </SelectTrigger>
                  <SelectContent>
                    {activeVendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        🧑‍💼 {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk Repartidor Change */}
                <Select onValueChange={handleBulkRepartidorChange} disabled={isBulkUpdating}>
                  <SelectTrigger className="w-auto min-w-[160px]">
                    <Truck className="w-4 h-4 mr-2" />
                    <span className="text-sm">Asignar repartidor</span>
                  </SelectTrigger>
                  <SelectContent>
                    {activeRepartidores.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        🚚 {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="mt-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {isAdmin && filteredOrders.length > 0 && (
                <div className="flex items-center">
                  <Checkbox
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </div>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={settings.language === 'es' ? 'Buscar por cliente o ID...' : 'Search by customer or ID...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {settings.language === 'es' ? 'Todos los estados' : 'All statuses'}
                  </SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {ORDER_STATUS_CONFIG[status].icon} {settings.language === 'es' ? ORDER_STATUS_CONFIG[status].label : ORDER_STATUS_CONFIG[status].labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder={settings.language === 'es' ? 'Vendedor' : 'Vendor'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {settings.language === 'es' ? 'Todos los vendedores' : 'All vendors'}
                  </SelectItem>
                  {vendedores.filter(v => v.active).map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      🧑‍💼 {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Export Dropdown - Hidden in menu */}
            {isAdmin && filteredOrders.length > 0 && (
              <div className="flex items-center justify-end pt-2 border-t">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar ({filteredOrders.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleExportFiltered('pdf')}>
                      <FileText className="w-4 h-4 mr-2" />
                      📄 Vista actual (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportFiltered('xls')}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      📊 Vista actual (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {activeTab === 'active' && (
                      <>
                        <DropdownMenuItem onClick={() => handleExportByStatus('pending', 'pdf')}>
                          🕐 Pendientes (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportByStatus('pending', 'xls')}>
                          🕐 Pendientes (Excel)
                        </DropdownMenuItem>
                      </>
                    )}
                    {activeTab === 'history' && (
                      <>
                        <DropdownMenuItem onClick={() => handleExportByStatus('delivered', 'pdf')}>
                          ✅ Entregados (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportByStatus('delivered', 'xls')}>
                          ✅ Entregados (Excel)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleExportByStatus('cancelled', 'pdf')}>
                          ❌ Cancelados (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportByStatus('cancelled', 'xls')}>
                          ❌ Cancelados (Excel)
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium text-muted-foreground">
                {activeTab === 'active' 
                  ? '¡Sin pedidos activos!'
                  : activeTab === 'backorders'
                    ? '¡Sin pre-pedidos!'
                    : 'Sin pedidos en esta fecha'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Intenta cambiar los filtros de búsqueda'
                  : activeTab === 'active'
                    ? 'Todos los pedidos están completados'
                    : activeTab === 'backorders'
                      ? 'Los pre-pedidos se crean automáticamente cuando no hay stock disponible'
                      : 'Selecciona otra fecha para ver el historial'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 mt-4">
            {filteredOrders.map((order: Order, index: number) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card 
                  className={`card-interactive cursor-pointer ${selectedOrders.includes(order.id) ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {isAdmin && (
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div 
                        className="flex-1 min-w-0 flex items-center gap-4"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{order.customer_name}</p>
                            <span className={`px-2.5 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1 ${ORDER_STATUS_CONFIG[order.status].className}`}>
                              {ORDER_STATUS_CONFIG[order.status].icon} {settings.language === 'es' ? ORDER_STATUS_CONFIG[order.status].label : ORDER_STATUS_CONFIG[order.status].labelEn}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span>#{order.id.slice(0, 8)}</span>
                            <span>•</span>
                            <span>{order.order_items?.length || 0} {settings.language === 'es' ? 'producto' : 'product'}{(order.order_items?.length || 0) !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span className="font-medium text-foreground">{formatCurrency(order.total)}</span>
                            {order.vendedor_name && (
                              <>
                                <span>•</span>
                                <span className="text-primary font-medium">🧑‍💼 {order.vendedor_name}</span>
                              </>
                            )}
                          </div>
                          {order.delivery_address && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>📍 {order.delivery_address}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {isAdmin && (order.status === 'pending' || order.status === 'ready' || order.status === 'delivery') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRevealPinOrderId(order.id);
                                    setIsRevealPinDialogOpen(true);
                                  }}
                                  title="Revelar PIN (requiere código)"
                                >
                                  <Key className="w-5 h-5" />
                                </Button>
                              )}
                              {(order.status === 'pending' || order.status === 'ready' || order.status === 'delivery') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWhatsAppPIN(order);
                                  }}
                                  title="Enviar PIN por WhatsApp"
                                >
                                  <MessageSquare className="w-5 h-5" />
                                </Button>
                              )}

                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">
                              {format(new Date(order.created_at), 'dd MMM', { locale })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), 'HH:mm')}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </Tabs>

      {/* Delete Dialog */}
        <DeleteOrdersDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          orderIds={selectedOrders}
          deleteAll={deleteAll}
          onSuccess={handleDeleteSuccess}
          language={settings.language}
        />
        
        {revealPinOrderId && (
          <RevealPinDialog
            open={isRevealPinDialogOpen}
            onOpenChange={setIsRevealPinDialogOpen}
            orderId={revealPinOrderId}
            onSuccess={() => {}}
          />
        )}

        <MarkDeliveredOTPDialog
          open={isMarkDeliveredOpen}
          onOpenChange={setIsMarkDeliveredOpen}
          orderIds={pendingDeliveredIds}
          onSuccess={() => {
            setSelectedOrders([]);
            setPendingDeliveredIds([]);
            refetch();
          }}
        />
      </div>
    );
  }
