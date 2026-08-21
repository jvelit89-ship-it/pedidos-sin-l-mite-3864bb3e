import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomers } from '@/hooks/useCustomers';
import { getEmptyCustomerMapStat, useCustomerMapStats } from '@/hooks/useCustomerMapStats';
import { MapView } from '@/components/MapView';
import { CustomerPurchaseHistory } from '@/components/CustomerPurchaseHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Map, Filter, Loader2, Phone, MapPin, User, Store, Package, ExternalLink, ShoppingBag, Clock, RotateCcw } from 'lucide-react';
import { SecureImage } from '@/components/SecureImage';

interface Customer {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: 'regular' | 'premium' | 'vip' | null;
  customer_type: 'minorista' | 'mayorista' | 'distribuidor';
  notes: string | null;
  company_id: string;
  facade_photo_url: string | null;
  vendedor_id: string | null;
}

type CustomerDistrict =
  | 'barranca'
  | 'paramonga'
  | 'pativilca'
  | 'supe'
  | 'supe-puerto'
  | 'unknown';

const DISTRICT_OPTIONS: Array<{
  value: Exclude<CustomerDistrict, 'unknown'>;
  label: string;
  patterns: string[];
}> = [
  // Supe Puerto must be checked before Supe so both districts are not mixed.
  { value: 'supe-puerto', label: 'Supe Puerto', patterns: ['supe puerto', 'puerto supe'] },
  { value: 'paramonga', label: 'Paramonga', patterns: ['paramonga'] },
  { value: 'pativilca', label: 'Pativilca', patterns: ['pativilca'] },
  { value: 'supe', label: 'Supe', patterns: ['supe'] },
  { value: 'barranca', label: 'Barranca', patterns: ['barranca'] },
];

function normalizeLocationText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getCustomerDistrict(customer: Pick<Customer, 'address'>): CustomerDistrict {
  const address = normalizeLocationText(customer.address || '');
  if (!address) return 'unknown';

  for (const district of DISTRICT_OPTIONS) {
    if (district.patterns.some((pattern) => address.includes(pattern))) {
      return district.value;
    }
  }

  return 'unknown';
}

function hasValidCoordinates(customer: Pick<Customer, 'latitude' | 'longitude'>) {
  const lat = Number(customer.latitude);
  const lng = Number(customer.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export default function CustomersMapPage() {
  const { user, isAdmin } = useAuth();
  const { t, formatCurrency } = useSettings();
  const { customers, loading: loadingCustomers } = useCustomers();
  const {
    stats: customerStats,
    loading: loadingStats,
    lastUpdatedAt,
  } = useCustomerMapStats(user?.companyId);

  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [volumeFilter, setVolumeFilter] = useState<string>('all');
  const [pendingFilter, setPendingFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const isLoading = loadingCustomers || loadingStats;
  const filtersActive =
    districtFilter !== 'all' ||
    categoryFilter !== 'all' ||
    volumeFilter !== 'all' ||
    pendingFilter !== 'all';

  const districtCounts = useMemo(() => {
    const counts: Record<CustomerDistrict, number> = {
      barranca: 0,
      paramonga: 0,
      pativilca: 0,
      supe: 0,
      'supe-puerto': 0,
      unknown: 0,
    };

    customers.forEach((customer) => {
      if (!hasValidCoordinates(customer as Customer)) return;
      counts[getCustomerDistrict(customer as Customer)] += 1;
    });

    return counts;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (!hasValidCoordinates(customer as Customer)) return false;

      const district = getCustomerDistrict(customer as Customer);
      if (districtFilter !== 'all' && district !== districtFilter) return false;

      // Older customer records may have null category. In the UI those records
      // have always behaved like Regular, so normalize them before filtering.
      const normalizedCategory = customer.category || 'regular';
      if (categoryFilter !== 'all' && normalizedCategory !== categoryFilter) return false;

      const stats = customerStats[customer.id] || getEmptyCustomerMapStat();

      if (volumeFilter === 'high' && stats.totalOrders < 5) return false;
      if (volumeFilter === 'medium' && (stats.totalOrders < 2 || stats.totalOrders >= 5)) return false;
      if (volumeFilter === 'low' && stats.totalOrders >= 2) return false;

      if (pendingFilter === 'pending' && !stats.hasPendingOrders) return false;
      if (pendingFilter === 'none' && stats.hasPendingOrders) return false;

      return true;
    });
  }, [customers, customerStats, districtFilter, categoryFilter, volumeFilter, pendingFilter]);

  const mapMarkers = useMemo(() => {
    return filteredCustomers.map((customer) => {
      const stats = customerStats[customer.id] || getEmptyCustomerMapStat();
      return {
        id: customer.id,
        lat: Number(customer.latitude),
        lng: Number(customer.longitude),
        label: customer.name,
        category: customer.category || 'regular',
        hasPendingOrders: stats.hasPendingOrders,
        pendingOrdersCount: stats.pendingOrdersCount,
        phone: customer.phone || undefined,
        address: customer.address || undefined,
        totalOrders: stats.totalOrders,
        customerType: customer.customer_type,
      };
    });
  }, [filteredCustomers, customerStats]);

  const pendingVisibleCount = useMemo(
    () => filteredCustomers.filter((customer) => customerStats[customer.id]?.hasPendingOrders).length,
    [filteredCustomers, customerStats]
  );

  const filterSignature = `${districtFilter}-${categoryFilter}-${volumeFilter}-${pendingFilter}`;

  const handleMarkerClick = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId) as Customer | undefined;
    if (customer) {
      setSelectedCustomer(customer);
      setIsDetailDialogOpen(true);
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const clearFilters = () => {
    setDistrictFilter('all');
    setCategoryFilter('all');
    setVolumeFilter('all');
    setPendingFilter('all');
  };

  const lastUpdatedText = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

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

  const selectedStats = selectedCustomer
    ? customerStats[selectedCustomer.id] || getEmptyCustomerMapStat()
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Map className="w-6 h-6" /> {t.customersMap}
          </h1>
          {lastUpdatedText && (
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos del mapa actualizados: {lastUpdatedText}
            </p>
          )}
        </div>
        {filtersActive && (
          <Button variant="outline" size="sm" className="gap-2" onClick={clearFilters}>
            <RotateCcw className="w-4 h-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Distrito</label>
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {DISTRICT_OPTIONS.map((district) => (
                    <SelectItem key={district.value} value={district.value}>
                      {district.label} ({districtCounts[district.value]})
                    </SelectItem>
                  ))}
                  <SelectItem value="unknown">Sin identificar ({districtCounts.unknown})</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Pedidos Pendientes</label>
              <Select value={pendingFilter} onValueChange={setPendingFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">🔔 Con pendientes</SelectItem>
                  <SelectItem value="none">Sin pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1">
              {filteredCustomers.length} cliente(s) visibles
            </span>
            <span className="rounded-full bg-orange-50 text-orange-700 px-3 py-1">
              {pendingVisibleCount} con pendientes
            </span>
            <span>El volumen excluye pedidos cancelados.</span>
            <span>El distrito se identifica desde la dirección registrada del cliente.</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Map className="w-16 h-16 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay clientes que coincidan con los filtros seleccionados.</p>
            {filtersActive && (
              <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Mostrando {filteredCustomers.length} clientes •
              <span className="text-orange-600 ml-1">
                {pendingVisibleCount} con pedidos pendientes
              </span>
            </p>
            <MapView
              key={filterSignature}
              markers={mapMarkers}
              height="500px"
              onMarkerClick={handleMarkerClick}
            />
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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              <span>VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary ring-2 ring-orange-500 ring-offset-2"></div>
              <span className="text-orange-600">Con pedidos pendientes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-4 pb-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-3">
              {selectedCustomer?.facade_photo_url ? (
                <SecureImage
                  bucket="customer-photos"
                  path={selectedCustomer.facade_photo_url}
                  alt="Fachada"
                  className="w-12 h-12 rounded-lg object-cover"
                  fallback={
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <User className="w-6 h-6 text-muted-foreground" />
                    </div>
                  }
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{selectedCustomer?.name}</span>
                  {selectedCustomer?.customer_type === 'mayorista' && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      <Store className="w-3 h-3 inline mr-0.5" />
                      Mayorista
                    </span>
                  )}
                  {selectedCustomer?.category && selectedCustomer.category !== 'regular' && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      selectedCustomer.category === 'premium'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {selectedCustomer.category}
                    </span>
                  )}
                </div>
                {selectedCustomer?.business_name && (
                  <p className="text-sm text-muted-foreground font-normal">{selectedCustomer.business_name}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start px-4 pt-2">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="p-4 space-y-4">
                {selectedStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className={selectedStats.hasPendingOrders ? 'border-orange-500' : ''}>
                      <CardContent className="p-3 text-center">
                        <Package className={`w-5 h-5 mx-auto mb-1 ${selectedStats.hasPendingOrders ? 'text-orange-500' : 'text-muted-foreground'}`} />
                        <p className={`text-lg font-bold ${selectedStats.hasPendingOrders ? 'text-orange-500' : ''}`}>
                          {selectedStats.pendingOrdersCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Pendientes</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{selectedStats.totalOrders}</p>
                        <p className="text-xs text-muted-foreground">Total Pedidos</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <span className="text-lg">💰</span>
                        <p className="text-lg font-bold">{formatCurrency(selectedStats.totalSpent)}</p>
                        <p className="text-xs text-muted-foreground">Total Comprado</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{selectedStats.lastOrderDate || '-'}</p>
                        <p className="text-xs text-muted-foreground">Último Pedido</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardContent className="p-4 space-y-3">
                    {selectedCustomer?.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${selectedCustomer.phone}`} className="text-primary hover:underline">
                          {selectedCustomer.phone}
                        </a>
                      </div>
                    )}
                    {selectedCustomer?.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}
                    {selectedCustomer?.notes && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{selectedCustomer.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  {selectedCustomer?.latitude && selectedCustomer?.longitude && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => openInGoogleMaps(selectedCustomer.latitude!, selectedCustomer.longitude!)}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir en Google Maps
                    </Button>
                  )}
                  {selectedCustomer?.phone && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => window.open(`https://wa.me/51${selectedCustomer.phone}`, '_blank')}
                    >
                      💬 WhatsApp
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="p-4">
                {selectedCustomer && (
                  <CustomerPurchaseHistory
                    customerId={selectedCustomer.id}
                    customerName={selectedCustomer.name}
                    customerType={selectedCustomer.customer_type}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
