-- Fix false delivery geofence blocks caused by stale order coordinate snapshots.
-- Customer coordinates may be corrected after an order is created. For delivery
-- validation, the current customers.latitude/longitude is the source of truth.
-- Existing rules remain unchanged: <=200m, GPS required, plant pickup exception,
-- and Superadmin OTP administrative override.
CREATE OR REPLACE FUNCTION public.enforce_delivery_gps_on_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_lat double precision;
  target_lng double precision;
  distance_m double precision;
  is_plant_pickup boolean;
BEGIN
  IF NEW.status = 'delivered'
     AND OLD.status IS DISTINCT FROM 'delivered' THEN

    IF coalesce(current_setting('app.superadmin_otp_override', true), '') = 'on' THEN
      IF NEW.delivered_at IS NULL THEN
        NEW.delivered_at := now();
      END IF;
      RETURN NEW;
    END IF;

    is_plant_pickup := lower(trim(coalesce(NEW.repartidor_name, ''))) = 'recojo en planta';

    IF NOT is_plant_pickup THEN
      IF NEW.delivery_latitude IS NULL
         OR NEW.delivery_longitude IS NULL
         OR NEW.delivery_latitude < -90
         OR NEW.delivery_latitude > 90
         OR NEW.delivery_longitude < -180
         OR NEW.delivery_longitude > 180
         OR (NEW.delivery_latitude = 0 AND NEW.delivery_longitude = 0) THEN
        RAISE EXCEPTION 'GPS_REQUIRED_FOR_DELIVERY'
          USING ERRCODE = '23514',
                DETAIL = 'A delivery cannot transition to delivered without valid delivery coordinates.';
      END IF;

      -- Current customer coordinates take precedence over the order snapshot.
      SELECT c.latitude::double precision, c.longitude::double precision
        INTO target_lat, target_lng
      FROM public.customers c
      WHERE c.id = NEW.customer_id
        AND c.latitude IS NOT NULL
        AND c.longitude IS NOT NULL
        AND c.latitude BETWEEN -90 AND 90
        AND c.longitude BETWEEN -180 AND 180
        AND NOT (c.latitude = 0 AND c.longitude = 0);

      -- Fallback only when the customer itself has no usable coordinates.
      IF target_lat IS NULL OR target_lng IS NULL THEN
        target_lat := NEW.customer_latitude;
        target_lng := NEW.customer_longitude;
      END IF;

      IF target_lat IS NULL OR target_lng IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_LOCATION_REQUIRED'
          USING ERRCODE = '23514',
                DETAIL = 'The customer must have a valid stored location before delivery can be completed.';
      END IF;

      distance_m :=
        2 * 6371000 * asin(
          sqrt(
            power(sin(radians((NEW.delivery_latitude::double precision - target_lat) / 2)), 2)
            + cos(radians(target_lat))
            * cos(radians(NEW.delivery_latitude::double precision))
            * power(sin(radians((NEW.delivery_longitude::double precision - target_lng) / 2)), 2)
          )
        );

      IF distance_m > 200 THEN
        RAISE EXCEPTION 'DELIVERY_OUTSIDE_200M_GEOFENCE'
          USING ERRCODE = '23514',
                DETAIL = format('Driver is %.0f meters from the customer; maximum allowed is 200 meters.', distance_m);
      END IF;

      NEW.delivery_distance_m := distance_m;
    ELSE
      NEW.delivery_distance_m := NULL;
    END IF;

    IF NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_delivery_gps_on_completion ON public.orders;
CREATE TRIGGER enforce_delivery_gps_on_completion
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_delivery_gps_on_completion();

COMMENT ON FUNCTION public.enforce_delivery_gps_on_completion() IS
  'Requires <=200m GPS for normal deliveries, using current customer coordinates first; plant pickup and Superadmin OTP administrative override remain preserved.';

NOTIFY pgrst, 'reload schema';
