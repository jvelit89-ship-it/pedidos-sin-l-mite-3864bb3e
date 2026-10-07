import { supabase } from '@/integrations/supabase/client';

export const MAX_DELIVERY_RADIUS_M = 200;

export interface DeliveryGeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface ValidatedDeliveryCache {
  orderId: string;
  driver: DeliveryGeoPoint;
  distance: number;
  validatedAt: number;
}

let lastValidatedDelivery: ValidatedDeliveryCache | null = null;

export function getRecentValidatedDeliveryLocation(
  orderId: string,
  maxAgeMs: number = 60_000,
): ValidatedDeliveryCache | null {
  if (!lastValidatedDelivery) return null;
  if (lastValidatedDelivery.orderId !== orderId) return null;
  if (Date.now() - lastValidatedDelivery.validatedAt > maxAgeMs) return null;
  return lastValidatedDelivery;
}

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

function geolocationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return 'El navegador tiene bloqueado el permiso de ubicación. Actívalo para este sitio y vuelve a intentar.';
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return 'No se pudo determinar tu ubicación. Verifica que la ubicación del dispositivo esté activada e inténtalo nuevamente.';
  }
  if (err.code === err.TIMEOUT) {
    return 'La ubicación está demorando demasiado. Verifica que el GPS/ubicación esté activado y vuelve a intentar.';
  }
  return 'No se pudo obtener tu ubicación actual.';
}

function requestBrowserPosition(
  options: PositionOptions,
): Promise<DeliveryGeoPoint> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 9999,
        timestamp: pos.timestamp || Date.now(),
      }),
      reject,
      options,
    );
  });
}

const MAX_ACCEPTABLE_GPS_ACCURACY_M = 150;

/**
 * Acquire a fresh HIGH-ACCURACY position.
 *
 * Important: never fall back to low-accuracy/network positioning for delivery
 * confirmation. That fallback can place a phone kilometers away even while the
 * repartidor is physically at the customer's address. We retry high accuracy
 * once and keep the most precise sample.
 */
export async function getCurrentPositionStrict(): Promise<DeliveryGeoPoint> {
  if (!('geolocation' in navigator)) {
    throw new Error('Este dispositivo no soporta ubicación. No se puede marcar la entrega.');
  }

  if (window.isSecureContext === false) {
    throw new Error('La ubicación solo funciona en una conexión segura HTTPS.');
  }

  try {
    if ('permissions' in navigator && navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (permission.state === 'denied') {
        throw new Error('El navegador tiene bloqueado el permiso de ubicación. Actívalo para este sitio y vuelve a intentar.');
      }
    }
  } catch (permissionError) {
    if (permissionError instanceof Error && permissionError.message.includes('bloqueado')) {
      throw permissionError;
    }
  }

  let first: DeliveryGeoPoint | null = null;

  try {
    first = await requestBrowserPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    if (first.accuracy <= 60) return first;
  } catch (firstError) {
    const geoError = firstError as GeolocationPositionError;
    console.error('High accuracy geolocation error:', geoError);

    if (geoError?.code === geoError?.PERMISSION_DENIED) {
      throw new Error(geolocationErrorMessage(geoError));
    }
  }

  try {
    const second = await requestBrowserPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });

    const best = !first || second.accuracy < first.accuracy ? second : first;

    if (best.accuracy > MAX_ACCEPTABLE_GPS_ACCURACY_M) {
      throw new Error(
        `GPS impreciso (±${Math.round(best.accuracy)} m). Activa "Ubicación precisa" en el teléfono, enciende el GPS y vuelve a intentar, preferiblemente en un lugar abierto.`,
      );
    }

    return best;
  } catch (secondError) {
    if (secondError instanceof Error && secondError.message.startsWith('GPS impreciso')) {
      throw secondError;
    }

    if (first && first.accuracy <= MAX_ACCEPTABLE_GPS_ACCURACY_M) {
      return first;
    }

    console.error('Second high accuracy geolocation error:', secondError);
    throw new Error(
      secondError instanceof Error && secondError.message
        ? secondError.message
        : geolocationErrorMessage(secondError as GeolocationPositionError),
    );
  }
}

interface ValidateArgs {
  orderId: string;
  companyId?: string | null;
  repartidorId?: string | null;
  repartidorName?: string | null;
  customerName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  driverPosition?: DeliveryGeoPoint | null;
}

export interface ValidationResult {
  ok: boolean;
  distance: number | null;
  driver: DeliveryGeoPoint;
  accuracy: number;
  reason?: string;
}

/**
 * Validates delivery location is within MAX_DELIVERY_RADIUS_M of customer.
 * On failure, logs the attempt to delivery_location_attempts and returns ok=false.
 * On success, keeps the validated GPS result briefly so the order update can
 * persist status + coordinates atomically in the same database operation.
 */
export async function validateDeliveryLocation(args: ValidateArgs): Promise<ValidationResult> {
  const driver = args.driverPosition ?? await getCurrentPositionStrict();

  if (driver.accuracy > MAX_ACCEPTABLE_GPS_ACCURACY_M) {
    const reason =
      `GPS impreciso (±${Math.round(driver.accuracy)} m). Activa "Ubicación precisa" y vuelve a intentar.`;
    return { ok: false, distance: null, driver, accuracy: driver.accuracy, reason };
  }

  const isValidLatLng = (lat: unknown, lng: unknown) =>
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180 &&
    !(Number(lat) === 0 && Number(lng) === 0);

  // IMPORTANT: customer coordinates can be corrected after an order was created.
  // The order keeps a historical snapshot, so using it first can incorrectly block
  // a real delivery even when the repartidor is standing at the customer's current
  // saved location. Always prefer the CURRENT customer coordinates; only fall back
  // to the order snapshot when the customer record has no valid location.
  const { data: ord } = await supabase
    .from('orders')
    .select('customer_id, customer_latitude, customer_longitude')
    .eq('id', args.orderId)
    .maybeSingle();

  let customerLat: number | null = null;
  let customerLng: number | null = null;

  if (ord?.customer_id) {
    const { data: cust } = await supabase
      .from('customers')
      .select('latitude, longitude')
      .eq('id', ord.customer_id)
      .maybeSingle();

    if (isValidLatLng(cust?.latitude, cust?.longitude)) {
      customerLat = Number(cust!.latitude);
      customerLng = Number(cust!.longitude);
    }
  }

  if (!isValidLatLng(customerLat, customerLng) && isValidLatLng(args.customerLat, args.customerLng)) {
    customerLat = Number(args.customerLat);
    customerLng = Number(args.customerLng);
  }

  if (!isValidLatLng(customerLat, customerLng) && isValidLatLng(ord?.customer_latitude, ord?.customer_longitude)) {
    customerLat = Number(ord!.customer_latitude);
    customerLng = Number(ord!.customer_longitude);
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
    return { ok: false, distance: null, driver, accuracy: driver.accuracy, reason };
  }

  const distance = haversineMeters(driver.lat, driver.lng, customerLat, customerLng);

  if (distance > MAX_DELIVERY_RADIUS_M) {
    const reason = `Estás a ${Math.round(distance)} m del cliente (GPS ±${Math.round(driver.accuracy)} m). Debes estar a menos de ${MAX_DELIVERY_RADIUS_M} m para marcar entregado.`;
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
    return { ok: false, distance, driver, accuracy: driver.accuracy, reason };
  }

  lastValidatedDelivery = {
    orderId: args.orderId,
    driver,
    distance,
    validatedAt: Date.now(),
  };

  return { ok: true, distance, driver, accuracy: driver.accuracy };
}
