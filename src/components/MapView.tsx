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

interface MapViewProps {
  latitude?: number;
  longitude?: number;
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    category?: string;
  }>;
  onLocationSelect?: (lat: number, lng: number) => void;
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
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${
            marker.category === 'premium' ? 'bg-yellow-500' : 'bg-primary'
          }">${marker.label.charAt(0)}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const m = L.marker([marker.lat, marker.lng], { icon: customIcon })
          .bindPopup(`<strong>${marker.label}</strong><br/>${marker.category || ''}`)
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
