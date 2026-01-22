import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShoppingBag, TrendingUp, Calendar, Package, DollarSign, BarChart3, Wallet, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSettings } from '@/contexts/SettingsContext';
import { useDistributorCredits, useCreditUsage } from '@/hooks/useDistributorCredits';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Order {
  id: string;
  tracking_code: string | null;
  status: string;
  total: number;
  created_at: string;
  delivered_at: string | null;
  order_items: OrderItem[];
}

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  totalUnits: number;
  avgUnitsPerOrder: number;
  favoriteProducts: { name: string; quantity: number }[];
  orderFrequency: string;
  lastOrderDate: string | null;
}

interface CustomerPurchaseHistoryProps {
  customerId: string;
  customerName: string;
  customerType?: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  preparation: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ready: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  delivery: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparation: 'Preparación',
  ready: 'Listo',
  delivery: 'En Reparto',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// Distributor Stats Component
function DistributorStats({ customerId }: { customerId: string }) {
  const { settings } = useSettings();
  const { credits, loading } = useDistributorCredits(customerId);

  const formatCurrency = (value: number) => {
    const symbol = settings.currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate distributor-specific stats
  const activeCredits = credits.filter(c => c.is_active);
  const totalPrepaid = credits.reduce((sum, c) => sum + Number(c.amount_paid), 0);
  const totalCredits = credits.reduce((sum, c) => sum + c.total_credits, 0);
  const remainingCredits = activeCredits.reduce((sum, c) => sum + c.remaining_credits, 0);
  const usedCredits = totalCredits - remainingCredits;
  const lastPurchase = credits.length > 0 ? credits[0].purchase_date : null;

  if (credits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Este distribuidor no tiene paquetes de créditos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key metrics for distributors */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{remainingCredits}</p>
            <p className="text-xs text-green-600">Recargas Disponibles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <RefreshCw className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{usedCredits}</p>
            <p className="text-xs text-muted-foreground">Recargas Entregadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <p className="text-2xl font-bold">{formatCurrency(totalPrepaid)}</p>
            <p className="text-xs text-muted-foreground">Total Prepagado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-orange-600" />
            <p className="text-2xl font-bold">{totalCredits}</p>
            <p className="text-xs text-muted-foreground">Total Comprado</p>
          </CardContent>
        </Card>
      </div>

      {/* Active packages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Paquetes Activos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {activeCredits.map((credit) => (
            <div key={credit.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{credit.package_name}</span>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  Activo
                </Badge>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Disponibles</span>
                <span className="font-bold text-foreground">{credit.remaining_credits} / {credit.total_credits}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(credit.remaining_credits / credit.total_credits) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Pagado: {formatCurrency(Number(credit.amount_paid))}</span>
                <span>{format(new Date(credit.purchase_date), 'dd MMM yyyy', { locale: es })}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Paquetes totales</span>
            <span className="font-medium">{credits.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Paquetes activos</span>
            <Badge variant="secondary">{activeCredits.length}</Badge>
          </div>
          {lastPurchase && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Última compra</span>
              <span className="font-medium">
                {format(new Date(lastPurchase), 'dd MMM yyyy', { locale: es })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerPurchaseHistory({ customerId, customerName, customerType }: CustomerPurchaseHistoryProps) {
  const { settings } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  
  const isDistribuidor = customerType === 'distribuidor';

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, tracking_code, status, total, created_at, delivered_at, order_items(*)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching orders:', error);
          return;
        }

        setOrders(data || []);
        
        // Calculate stats (only for non-distributors or as secondary info)
        if (data && data.length > 0) {
          const deliveredOrders = data.filter(o => o.status === 'delivered');
          const totalSpent = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
          const totalUnits = data.flatMap(o => o.order_items || []).reduce((sum, item) => sum + item.quantity, 0);
          
          // Product frequency
          const productCounts: Record<string, number> = {};
          data.forEach(order => {
            (order.order_items || []).forEach((item: OrderItem) => {
              productCounts[item.product_name] = (productCounts[item.product_name] || 0) + item.quantity;
            });
          });
          
          const favoriteProducts = Object.entries(productCounts)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 3);

          // Calculate order frequency
          const firstOrder = new Date(data[data.length - 1].created_at);
          const lastOrder = new Date(data[0].created_at);
          const daysDiff = Math.max(1, Math.ceil((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24)));
          const ordersPerMonth = data.length > 1 ? (data.length / daysDiff) * 30 : 0;
          
          let frequencyText = 'Nueva';
          if (ordersPerMonth >= 8) frequencyText = 'Muy frecuente (semanal)';
          else if (ordersPerMonth >= 4) frequencyText = 'Frecuente (quincenal)';
          else if (ordersPerMonth >= 1) frequencyText = 'Regular (mensual)';
          else if (data.length > 1) frequencyText = 'Ocasional';

          setStats({
            totalOrders: data.length,
            totalSpent,
            avgOrderValue: deliveredOrders.length > 0 ? totalSpent / deliveredOrders.length : 0,
            totalUnits,
            avgUnitsPerOrder: data.length > 0 ? totalUnits / data.length : 0,
            favoriteProducts,
            orderFrequency: frequencyText,
            lastOrderDate: data[0]?.created_at || null,
          });
        } else {
          setStats(null);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [customerId]);

  const formatCurrency = (value: number) => {
    const symbol = settings.currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // For distributors, show credit-based stats
  if (isDistribuidor) {
    return (
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="w-4 h-4" />
            Entregas ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <DistributorStats customerId={customerId} />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <ScrollArea className="h-[300px]">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Sin entregas registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                          </span>
                        </div>
                        <Badge className={statusColors[order.status] || statusColors.pending}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        {(order.order_items || []).slice(0, 3).map((item: OrderItem) => (
                          <div key={item.id} className="flex justify-between text-muted-foreground">
                            <span className="truncate max-w-[60%]">{item.product_name}</span>
                            <span>x{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          Entrega de créditos prepagados
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  }

  // Regular customers
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Este cliente aún no tiene pedidos</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="stats" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="stats" className="gap-2">
          <BarChart3 className="w-4 h-4" />
          Estadísticas
        </TabsTrigger>
        <TabsTrigger value="orders" className="gap-2">
          <ShoppingBag className="w-4 h-4" />
          Pedidos ({orders.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stats" className="mt-4 space-y-4">
        {stats && (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Pedidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">Total Comprado</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
                  <p className="text-xs text-muted-foreground">Promedio/Pedido</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Package className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                  <p className="text-2xl font-bold">{stats.totalUnits}</p>
                  <p className="text-xs text-muted-foreground">Unidades Totales</p>
                </CardContent>
              </Card>
            </div>

            {/* Frequency and last order */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Frecuencia de compra</span>
                  <Badge variant="secondary">{stats.orderFrequency}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Promedio unidades/pedido</span>
                  <span className="font-medium">{stats.avgUnitsPerOrder.toFixed(1)}</span>
                </div>
                {stats.lastOrderDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Último pedido</span>
                    <span className="font-medium">
                      {format(new Date(stats.lastOrderDate), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Favorite products */}
            {stats.favoriteProducts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Productos Favoritos</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {stats.favoriteProducts.map((product, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm truncate max-w-[70%]">
                          {idx === 0 && '🥇 '}
                          {idx === 1 && '🥈 '}
                          {idx === 2 && '🥉 '}
                          {product.name}
                        </span>
                        <Badge variant="outline">{product.quantity} uds</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="orders" className="mt-4">
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                      </span>
                    </div>
                    <Badge className={statusColors[order.status] || statusColors.pending}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </div>
                  
                  {order.tracking_code && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Código: {order.tracking_code}
                    </p>
                  )}

                  <div className="text-sm space-y-1">
                    {(order.order_items || []).slice(0, 3).map((item: OrderItem) => (
                      <div key={item.id} className="flex justify-between text-muted-foreground">
                        <span className="truncate max-w-[60%]">{item.product_name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    ))}
                    {(order.order_items || []).length > 3 && (
                      <p className="text-xs text-muted-foreground italic">
                        +{order.order_items.length - 3} productos más
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold text-primary">{formatCurrency(order.total)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
