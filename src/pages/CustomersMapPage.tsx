import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllItems } from '@/lib/db';
import { Customer, Order } from '@/types';
import { MapView } from '@/components/MapView';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Map, Filter } from 'lucide-react';

export default function CustomersMapPage() {
  const { isAdmin } = useAuth();
  const { t } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [volumeFilter, setVolumeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [customersData, ordersData] = await Promise.all([
      getAllItems('customers'),
      getAllItems('orders'),
    ]);
    setCustomers(customersData);
    setOrders(ordersData);
    setIsLoading(false);
  };

  // Calculate order count per customer
  const customerOrderCounts = customers.reduce((acc, customer) => {
    acc[customer.id] = orders.filter((o) => o.customerId === customer.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    if (!c.latitude || !c.longitude) return false;
    
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    
    const orderCount = customerOrderCounts[c.id] || 0;
    if (volumeFilter === 'high' && orderCount < 5) return false;
    if (volumeFilter === 'medium' && (orderCount < 2 || orderCount >= 5)) return false;
    if (volumeFilter === 'low' && orderCount >= 2) return false;
    
    return true;
  });

  const mapMarkers = filteredCustomers.map((c) => ({
    id: c.id,
    lat: c.latitude!,
    lng: c.longitude!,
    label: c.name,
    category: c.category,
  }));

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes acceso a esta sección</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Map className="w-6 h-6" /> {t.customersMap}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Categoría</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Volumen de Pedidos</label>
              <Select value={volumeFilter} onValueChange={setVolumeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="high">Alto (5+ pedidos)</SelectItem>
                  <SelectItem value="medium">Medio (2-4 pedidos)</SelectItem>
                  <SelectItem value="low">Bajo (0-1 pedidos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Map className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay clientes con ubicación</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Mostrando {filteredCustomers.length} clientes
            </p>
            <MapView markers={mapMarkers} height="500px" />
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Leyenda</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary"></div>
              <span>Regular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span>Premium</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
