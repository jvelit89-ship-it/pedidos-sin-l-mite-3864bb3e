import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SyncIndicator, SyncStatusBadge } from '@/components/SyncIndicator';
import { getAllItems } from '@/lib/db';
import { Order, ORDER_STATUS_CONFIG, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Filter,
  Package,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      let allOrders = await getAllItems('orders');
      
      // For vendedor, only show their orders
      if (user?.role === 'vendedor') {
        allOrders = allOrders.filter(o => o.vendedorId === user.id);
      }
      
      // Sort by date, newest first
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(allOrders);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator />
          <Button onClick={() => navigate('/orders/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Pedido</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
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

      {/* Orders List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">No hay pedidos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm || statusFilter !== 'all' 
                ? 'Intenta cambiar los filtros de búsqueda'
                : 'Crea tu primer pedido para comenzar'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card 
                className="card-interactive cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{order.customerName}</p>
                        <span className={`px-2.5 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1 ${ORDER_STATUS_CONFIG[order.status].className}`}>
                          {ORDER_STATUS_CONFIG[order.status].icon} {ORDER_STATUS_CONFIG[order.status].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>#{order.id.slice(0, 8)}</span>
                        <span>•</span>
                        <span>{order.items.length} producto{order.items.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground">${order.total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>📍 {order.deliveryAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SyncStatusBadge status={order.syncStatus} />
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">
                          {format(new Date(order.createdAt), 'dd MMM', { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.createdAt), 'HH:mm')}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
