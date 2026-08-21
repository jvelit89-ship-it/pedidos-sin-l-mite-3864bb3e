import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Truck, CheckCircle2, User } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Fix for default marker icons in Leaflet with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface DeliveryPoint {
  order_id: string;
  customer_name: string;
  repartidor_name: string;
  lat: number;
  lng: number;
  delivered_at: string;
  total: number;
}

interface DeliveryGeostatisticsProps {
  orders: any[];
}

function MapViewportSync({ points }: { points: DeliveryPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const refreshViewport = () => {
      map.invalidateSize();

      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 15, { animate: false });
        return;
      }

      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
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
  }, [map, points]);

  return null;
}

export function DeliveryGeostatistics({ orders }: DeliveryGeostatisticsProps) {
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivered'),
    [orders]
  );

  const deliveryPoints = useMemo(() => {
    return deliveredOrders
      .filter((o) => {
        const lat = Number(o.delivery_latitude);
        const lng = Number(o.delivery_longitude);
        return (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180 &&
          !(lat === 0 && lng === 0)
        );
      })
      .map((o) => ({
        order_id: o.id,
        customer_name: o.customer_name,
        repartidor_name: o.repartidor_name || 'Desconocido',
        lat: Number(o.delivery_latitude),
        lng: Number(o.delivery_longitude),
        delivered_at: o.delivered_at,
        total: o.total
      })) as DeliveryPoint[];
  }, [deliveredOrders]);

  const center: [number, number] = deliveryPoints.length > 0 
    ? [deliveryPoints[0].lat, deliveryPoints[0].lng] 
    : [-12.046374, -77.042793]; // Default to Lima

  const totalDelivered = deliveredOrders.length;
  const totalGeolocated = deliveryPoints.length;
  const geolocationCoverage = totalDelivered > 0
    ? Math.round((totalGeolocated / totalDelivered) * 100)
    : 0;

  if (deliveryPoints.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>No hay datos geolocalizados de entregas.</p>
          {totalDelivered > 0 && (
            <p className="text-xs mt-2">
              Hay {totalDelivered} entrega(s) completada(s), pero ninguna tiene coordenadas GPS guardadas.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const uniqueRepartidores = new Set(deliveryPoints.map(p => p.repartidor_name)).size;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Geolocalización de Entregas
          </CardTitle>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Entregas GPS</span>
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
        
        <div className="p-4 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-4 border-t">
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" /> Rendimiento por Repartidor
            </p>
            <div className="space-y-1.5">
               {Array.from(new Set(deliveryPoints.map(p => p.repartidor_name))).map(name => {
                 const count = deliveryPoints.filter(p => p.repartidor_name === name).length;
                 const percentage = Math.round((count / totalGeolocated) * 100);
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
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Cobertura GPS de Entregas</p>
              <p className="text-2xl font-black text-primary">{geolocationCoverage}%</p>
              <p className="text-[10px] text-muted-foreground">
                {totalGeolocated} de {totalDelivered} entrega(s) con ubicación registrada
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
