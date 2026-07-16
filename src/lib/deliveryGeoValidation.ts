import { supabase } from '@/integrations/supabase/client';

export const MAX_DELIVERY_RADIUS_M = 500;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function getCurrentPositionStrict(): Promise<{ lat: number; lng: number }> {
  if (!('geolocation' in navigator)) {
    throw new Error('Este dispositivo no soporta GPS. No se puede marcar la entrega.');
  }
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error('Geolocation error:', err);
        reject(new Error('Debes activar el GPS para marcar como entregado.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

interface ValidateArgs {
  orderId: string;
  companyId?: string | null;
  repartidorId?: string | null;
  repartidorName?: string | null;
  customerName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
}

export interface ValidationResult {
  ok: boolean;
  distance: number | null;
  driver: { lat: number; lng: number };
  reason?: string;
}

/**
 * Validates delivery location is within MAX_DELIVERY_RADIUS_M of customer.
 * On failure, logs the attempt to delivery_location_attempts and returns ok=false.
 */
export async function validateDeliveryLocation(args: ValidateArgs): Promise<ValidationResult> {
  const driver = await getCurrentPositionStrict();

  let customerLat = args.customerLat ?? null;
  let customerLng = args.customerLng ?? null;

  // Fallback: fetch from customer via order
  if (customerLat == null || customerLng == null) {
    const { data: ord } = await supabase
      .from('orders')
      .select('customer_id, customer_latitude, customer_longitude')
      .eq('id', args.orderId)
      .maybeSingle();
    if (ord) {
      customerLat = ord.customer_latitude ?? customerLat;
      customerLng = ord.customer_longitude ?? customerLng;
      if ((customerLat == null || customerLng == null) && ord.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('latitude, longitude')
          .eq('id', ord.customer_id)
          .maybeSingle();
        customerLat = cust?.latitude ?? customerLat;
        customerLng = cust?.longitude ?? customerLng;
      }
    }
  }

  if (customerLat == null || customerLng == null) {
    const reason = 'El cliente no tiene coordenadas registradas. Pide al admin geolocalizar al cliente antes de entregar.';
    await supabase.from('delivery_location_attempts').insert({
      order_id: args.orderId,
      company_id: args.companyId ?? null,
      repartidor_id: args.repartidorId ?? null,
      repartidor_name: args.repartidorName ?? null,
      customer_name: args.customerName ?? null,
      driver_lat: driver.lat,
      driver_lng: driver.lng,
      blocked: true,
      reason,
    });
    return { ok: false, distance: null, driver, reason };
  }

  const distance = haversineMeters(driver.lat, driver.lng, customerLat, customerLng);

  if (distance > MAX_DELIVERY_RADIUS_M) {
    const reason = `Estás a ${Math.round(distance)} m del cliente. Debes estar a menos de ${MAX_DELIVERY_RADIUS_M} m para marcar entregado.`;
    await supabase.from('delivery_location_attempts').insert({
      order_id: args.orderId,
      company_id: args.companyId ?? null,
      repartidor_id: args.repartidorId ?? null,
      repartidor_name: args.repartidorName ?? null,
      customer_name: args.customerName ?? null,
      customer_lat: customerLat,
      customer_lng: customerLng,
      driver_lat: driver.lat,
      driver_lng: driver.lng,
      distance_m: distance,
      blocked: true,
      reason,
    });
    return { ok: false, distance, driver, reason };
  }

  return { ok: true, distance, driver };
}
