import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Truck, CheckCircle2, User, History, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayLimaDateKey } from '@/lib/limaTime';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface TodayDelivery {
  id: string;
  tracking_code: string | null;
  customer_name: string;
  repartidor_name: string | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_distance_m: number | null;
  delivered_at: string;
  total: number;
}

interface DeliveryPoint {
  order_id: string;
  customer_name: string;
  repartidor_name: string;
  lat: number;
  lng: number;
  delivered_at: string;
  total: number;
}

function getTodayLimaUtcRange() {
  const limaDate = getTodayLimaDateKey();
  const start = new Date(`${limaDate}T00:00:00-05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    dateKey: limaDate,
  };
}

function hasValidDeliveryGps(delivery: Pick<TodayDelivery, 'delivery_latitude' | 'delivery_longitude'>) {
  const lat = Number(delivery.delivery_latitude);
  const lng = Number(delivery.delivery_longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function MapViewportSync({ points }: { points: DeliveryPoint[] }) {
  const map = useMap();
  const signature = useMemo(
    () => points.map((point) => `${point.order_id}:${point.lat}:${point.lng}`).join('|'),
    [points]
  );

  useEffect(() => {
    if (points.length === 0) return;

    const refreshViewport = () => {
      map.invalidateSize();

      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 15, { animate: false });
        return;
      }

      const bounds = L.latLngBounds(
        points.map((point) => [point.lat, point.lng] as [number, number])
      );

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [32, 32],
          maxZoom: 15,
          animate: false,
        });
      }
    };

    const frame = window.requestAnimationFrame(refreshViewport);
    const timeout = window.setTimeout(refreshViewport, 250);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [map, signature]);

  return null;
}

function DeliveryHistoryList({ deliveries }: { deliveries: TodayDelivery[] }) {
  return (
    <div className="border-t bg-background">
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b">
        <div>
          <p className="font-semibold flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de entregas de hoy
          </p>
          <p className="text-xs text-muted-foreground">
            Debe coincidir 1 a 1 con los pedidos marcados como Entregado hoy.
          </p>
        </div>
        <span className="text-sm font-bold text-primary">{deliveries.length} pedido(s)</span>
      </div>

      {deliveries.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Aún no hay pedidos entregados hoy.
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Hora</th>
                <th className="px-4 py-2 font-medium">Pedido</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Repartidor</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-center">GPS</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const hasGps = hasValidDeliveryGps(delivery);
                const orderCode = delivery.tracking_code || delivery.id.slice(0, 8).toUpperCase();
                return (
                  <tr key={delivery.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {format(new Date(delivery.delivered_at), 'HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{orderCode}</td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <p className="font-medium">{delivery.customer_name}</p>
                      {delivery.delivery_address && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                          {delivery.delivery_address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {delivery.repartidor_name || 'Sin repartidor'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                      {formatMoney(delivery.total)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {hasGps ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-1 text-[11px] font-medium">
                          ✓ GPS
                          {delivery.delivery_distance_m != null
                            ? ` · ${Math.round(Number(delivery.delivery_distance_m))} m`
                            : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 px-2 py-1 text-[11px] font-medium">
                          Sin GPS
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { window.location.href = `/orders/${delivery.id}`; }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        Ver <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DeliveryGeostatistics() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [todayDeliveries, setTodayDeliveries] = useState<TodayDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchTodayDeliveries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const { start, end } = getTodayLimaUtcRange();

    let query = supabase
      .from('orders')
      .select('id, tracking_code, customer_name, repartidor_name, delivery_address, delivery_latitude, delivery_longitude, delivery_distance_m, delivered_at, total')
      .eq('status', 'delivered')
      .gte('delivered_at', start)
      .lt('delivered_at', end)
      .order('delivered_at', { ascending: false });

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;

    if (error) {
      console.error('Error refreshing today delivery map:', error);
      setRefreshError('No se pudo actualizar la geolocalización de entregas.');
    } else {
      setTodayDeliveries((data || []) as TodayDelivery[]);
      setRefreshError(null);
      setLastUpdatedAt(new Date());
    }

    if (!silent) setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchTodayDeliveries(false);

    const realtimeConfig: any = {
      event: '*',
      schema: 'public',
      table: 'orders',
    };

    if (companyId) realtimeConfig.filter = `company_id=eq.${companyId}`;

    const channel = supabase
      .channel(`dashboard-delivery-map-${companyId || 'all'}-${Date.now()}`)
      .on('postgres_changes', realtimeConfig, () => fetchTodayDeliveries(true))
      .subscribe();

    const polling = window.setInterval(() => fetchTodayDeliveries(true), 20_000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchTodayDeliveries(true);
    };
    const refreshOnFocus = () => fetchTodayDeliveries(true);

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(polling);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [companyId, fetchTodayDeliveries]);

  const deliveryPoints = useMemo(() => {
    return todayDeliveries
      .filter(hasValidDeliveryGps)
      .map((delivery) => ({
        order_id: delivery.id,
        customer_name: delivery.customer_name,
        repartidor_name: delivery.repartidor_name || 'Desconocido',
        lat: Number(delivery.delivery_latitude),
        lng: Number(delivery.delivery_longitude),
        delivered_at: delivery.delivered_at,
        total: delivery.total,
      })) as DeliveryPoint[];
  }, [todayDeliveries]);

  const center: [number, number] = deliveryPoints.length > 0
    ? [deliveryPoints[0].lat, deliveryPoints[0].lng]
    : [-10.7525, -77.7599];

  const totalDelivered = todayDeliveries.length;
  const totalGeolocated = deliveryPoints.length;
  const geolocationCoverage = totalDelivered > 0
    ? Math.round((totalGeolocated / totalDelivered) * 100)
    : 0;

  const uniqueRepartidores = new Set(
    todayDeliveries.map((delivery) => delivery.repartidor_name || 'Desconocido')
  ).size;

  const repartidorPerformance = useMemo(() => {
    const counts = new Map<string, number>();
    todayDeliveries.forEach((delivery) => {
      const name = delivery.repartidor_name || 'Desconocido';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [todayDeliveries]);

  const lastUpdatedText = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <div className="animate-spin w-7 h-7 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p>Actualizando entregas de hoy...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Geolocalización de Entregas de Hoy
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Actualización automática en tiempo real{lastUpdatedText ? ` · ${lastUpdatedText}` : ''}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Entregas hoy</span>
              <span className="text-xl font-bold text-primary">{totalDelivered}</span>
            </div>
            <div className="flex flex-col items-end border-l pl-4">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Con GPS</span>
              <span className="text-xl font-bold text-primary">{totalGeolocated}</span>
            </div>
            <div className="flex flex-col items-end border-l pl-4">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Repartidores</span>
              <span className="text-xl font-bold text-primary">{uniqueRepartidores}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {refreshError && (
          <div className="px-4 py-2 text-xs text-destructive bg-destructive/5 border-b">
            {refreshError} Se conserva la última información disponible.
          </div>
        )}

        {deliveryPoints.length > 0 ? (
          <div className="h-[400px] w-full z-0">
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapViewportSync points={deliveryPoints} />
              {deliveryPoints.map((point) => (
                <Marker key={point.order_id} position={[point.lat, point.lng]}>
                  <Popup className="custom-popup">
                    <div className="p-2 space-y-1">
                      <p className="font-bold text-primary text-sm">{point.customer_name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Truck className="w-3 h-3" />
                        <span>Repartidor: {point.repartidor_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>{format(new Date(point.delivered_at), "HH:mm 'hs' (d MMM)", { locale: es })}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div className="h-[240px] flex flex-col items-center justify-center text-center text-muted-foreground px-6">
            <MapPin className="w-12 h-12 mb-3 opacity-20" />
            {totalDelivered === 0 ? (
              <p>Aún no hay entregas completadas hoy.</p>
            ) : (
              <>
                <p>Hay {totalDelivered} entrega(s) realizada(s) hoy, pero ninguna tiene GPS guardado.</p>
                <p className="text-xs mt-2">Revisa el historial inferior para identificar los pedidos afectados.</p>
              </>
            )}
          </div>
        )}

        {totalDelivered > 0 && (
          <div className="p-4 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-4 border-t">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <User className="w-3 h-3" /> Rendimiento por Repartidor Hoy
              </p>
              <div className="space-y-1.5">
                {repartidorPerformance.map(([name, count]) => {
                  const percentage = Math.round((count / totalDelivered) * 100);
                  return (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 pr-2">{name}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="font-bold w-6 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="text-center">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Cobertura GPS de Hoy</p>
                <p className="text-2xl font-black text-primary">{geolocationCoverage}%</p>
                <p className="text-[10px] text-muted-foreground">
                  {totalGeolocated} de {totalDelivered} entrega(s) de hoy con ubicación registrada
                </p>
              </div>
            </div>
          </div>
        )}

        <DeliveryHistoryList deliveries={todayDeliveries} />
      </CardContent>
    </Card>
  );
}
