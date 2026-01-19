import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  category?: string;
  hasPendingOrders?: boolean;
  pendingOrdersCount?: number;
  phone?: string;
  address?: string;
  totalOrders?: number;
  customerType?: string;
}

interface MapViewProps {
  latitude?: number;
  longitude?: number;
  markers?: MarkerData[];
  onLocationSelect?: (lat: number, lng: number) => void;
  onMarkerClick?: (markerId: string) => void;
  editable?: boolean;
  height?: string;
  showRoute?: boolean;
  routePoints?: Array<{ lat: number; lng: number }>;
}

export function MapView({
  latitude,
  longitude,
  markers,
  onLocationSelect,
  onMarkerClick,
  editable = false,
  height = '300px',
  showRoute = false,
  routePoints,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultLat = latitude || 19.4326;
    const defaultLng = longitude || -99.1332;

    mapInstanceRef.current = L.map(mapRef.current).setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    if (editable) {
      mapInstanceRef.current.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current!);
        }
        onLocationSelect?.(lat, lng);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update main marker when lat/lng changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (latitude && longitude) {
      mapInstanceRef.current.setView([latitude, longitude], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude]).addTo(mapInstanceRef.current);
      }
    }
  }, [latitude, longitude]);

  // Handle multiple markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    if (markers && markers.length > 0) {
      const bounds: L.LatLngBoundsExpression = [];
      
      markers.forEach((marker) => {
        // Determine marker color based on category and pending orders
        let bgColor = 'bg-primary';
        let borderStyle = '';
        
        if (marker.hasPendingOrders) {
          borderStyle = 'ring-2 ring-orange-500 ring-offset-2';
        }
        
        if (marker.category === 'vip') {
          bgColor = 'bg-purple-500';
        } else if (marker.category === 'premium') {
          bgColor = 'bg-yellow-500';
        }

        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div class="relative">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${bgColor} ${borderStyle}">${marker.label.charAt(0)}</div>
            ${marker.hasPendingOrders ? `<div class="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">${marker.pendingOrdersCount}</div>` : ''}
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        // Build popup content
        const pendingBadge = marker.hasPendingOrders 
          ? `<span class="inline-block px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 mb-1">🔔 ${marker.pendingOrdersCount} pedido(s) pendiente(s)</span><br/>`
          : '';
        
        const typeBadge = marker.customerType === 'mayorista'
          ? `<span class="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Mayorista</span> `
          : '';
        
        const categoryBadge = marker.category && marker.category !== 'regular'
          ? `<span class="inline-block px-2 py-0.5 text-xs rounded-full ${marker.category === 'premium' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}">${marker.category}</span>`
          : '';

        const popupContent = `
          <div class="min-w-[200px]">
            <strong class="text-base">${marker.label}</strong><br/>
            ${pendingBadge}
            <div class="flex gap-1 flex-wrap my-1">${typeBadge}${categoryBadge}</div>
            ${marker.phone ? `<div class="text-sm text-gray-600">📞 ${marker.phone}</div>` : ''}
            ${marker.address ? `<div class="text-sm text-gray-600 truncate max-w-[200px]">📍 ${marker.address}</div>` : ''}
            <div class="text-sm text-gray-600">📦 ${marker.totalOrders || 0} pedidos totales</div>
            <button 
              onclick="window.dispatchEvent(new CustomEvent('map-marker-click', { detail: '${marker.id}' }))"
              class="mt-2 w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Ver historial
            </button>
          </div>
        `;

        const m = L.marker([marker.lat, marker.lng], { icon: customIcon })
          .bindPopup(popupContent, { maxWidth: 250 })
          .addTo(markersLayerRef.current!);
        
        bounds.push([marker.lat, marker.lng]);
      });

      if (bounds.length > 1) {
        mapInstanceRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
      } else if (bounds.length === 1) {
        mapInstanceRef.current.setView(bounds[0] as L.LatLngExpression, 14);
      }
    }
  }, [markers]);

  // Listen for marker click events
  useEffect(() => {
    const handleMarkerClick = (e: CustomEvent) => {
      onMarkerClick?.(e.detail);
    };

    window.addEventListener('map-marker-click', handleMarkerClick as EventListener);
    return () => {
      window.removeEventListener('map-marker-click', handleMarkerClick as EventListener);
    };
  }, [onMarkerClick]);

  // Handle route display
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (showRoute && routePoints && routePoints.length > 1) {
      const latLngs = routePoints.map((p) => [p.lat, p.lng] as L.LatLngExpression);
      routeLineRef.current = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
      }).addTo(mapInstanceRef.current);

      mapInstanceRef.current.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [showRoute, routePoints]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: '100%' }}
      className="rounded-lg border border-border overflow-hidden z-0"
    />
  );
}
