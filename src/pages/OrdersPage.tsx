import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SyncIndicator } from '@/components/SyncIndicator';
import { DeleteOrdersDialog } from '@/components/DeleteOrdersDialog';
import { DailyClosing } from '@/components/dashboard/DailyClosing';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useVendedores } from '@/hooks/useTeam';
import { ORDER_STATUS_CONFIG, OrderStatus } from '@/types';
import { 
  Plus, 
  Search, 
  Filter,
  Package,
  ChevronRight,
  Loader2,
  Trash2,
  X
} from 'lucide-react';
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
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, formatCurrency, t } = useSettings();
  const { orders, loading, refetch } = useOrders();
  const { vendedores } = useVendedores();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteAll, setDeleteAll] = useState(false);

  const locale = settings.language === 'es' ? es : enUS;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Filter orders based on role
  const roleFilteredOrders = orders.filter((order: Order) => {
    if (user?.role === 'vendedor') {
      // For now, show all orders for vendedor until we link users to vendedores
      return true;
    }
    return true;
  });

  const filteredOrders = roleFilteredOrders.filter((order: Order) => {
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesVendedor = vendedorFilter === 'all' || order.vendedor_id === vendedorFilter;
    return matchesSearch && matchesStatus && matchesVendedor;
  });

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
          <Button onClick={() => navigate('/orders/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t.newOrder}</span>
          </Button>
        </div>
      </div>

      {/* Selection toolbar - shown when orders are selected */}
      {isAdmin && selectedOrders.length > 0 && (
        <Card className="border-primary">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={clearSelection}>
                  <X className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">
                  {selectedOrders.length} {settings.language === 'es' ? 'seleccionado(s)' : 'selected'}
                </span>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
                <Trash2 className="w-4 h-4" />
                {settings.language === 'es' ? 'Eliminar seleccionados' : 'Delete selected'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
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
                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {settings.language === 'es' ? config.label : config.labelEn}
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
        </CardContent>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">{t.noData}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm || statusFilter !== 'all' 
                ? (settings.language === 'es' ? 'Intenta cambiar los filtros de búsqueda' : 'Try changing the search filters')
                : (settings.language === 'es' ? 'Crea tu primer pedido para comenzar' : 'Create your first order to start')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
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
                      <div className="flex items-center gap-2">
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

      {/* Delete Dialog */}
      <DeleteOrdersDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        orderIds={selectedOrders}
        deleteAll={deleteAll}
        onSuccess={handleDeleteSuccess}
        language={settings.language}
      />
    </div>
  );
}
