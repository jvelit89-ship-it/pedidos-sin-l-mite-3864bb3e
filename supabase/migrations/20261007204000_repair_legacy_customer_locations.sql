-- Controlled cleanup for legacy customer locations accidentally captured from the
-- seller/device instead of the customer's physical address.
--
-- Strategy:
-- 1) Flag the known legacy coordinate cluster as requiring first-delivery revalidation.
-- 2) Preserve the normal 200 m geofence for every other customer.
-- 3) For a legacy-suspect customer only, allow ONE physical delivery with precise GPS
--    (<=150 m reported accuracy), then re-anchor the customer to that delivery point.
-- 4) Audit the repair and use the normal 200 m rule from then on.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_verified_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_accuracy_m double precision;

COMMENT ON COLUMN public.customers.location_source IS
  'Origin of the stored customer coordinates, e.g. legacy_suspect, explicit_update, driver_delivery_gps, superadmin_otp_driver_gps.';
COMMENT ON COLUMN public.customers.location_verified_at IS
  'Timestamp when the current customer coordinates were explicitly or operationally verified.';
COMMENT ON COLUMN public.orders.delivery_accuracy_m IS
  'Browser/device reported horizontal GPS accuracy in meters for the physical delivery proof.';

-- Mark existing coordinates. Only the known dense legacy cluster is treated as suspect.
UPDATE public.customers
SET location_source = CASE
      WHEN latitude IS NULL OR longitude IS NULL OR (latitude = 0 AND longitude = 0)
        THEN 'missing'
      WHEN latitude BETWEEN -10.7605 AND -10.7575
       AND longitude BETWEEN -77.7605 AND -77.7570
        THEN 'legacy_suspect'
      ELSE 'legacy_existing'
    END
WHERE location_source IS NULL;

-- Stefani Gomero has independent supporting evidence:
-- a prior physical delivery GPS agrees with the Avenida Lima / Las Palmeras map result.
UPDATE public.customers
SET latitude = -10.7485169,
    longitude = -77.761774,
    location_source = 'historical_driver_gps_verified',
    location_verified_at = now(),
    updated_at = now()
WHERE id = '77a697db-a626-4ae6-9bda-93dc965fe229'::uuid
  AND location_source = 'legacy_suspect';

CREATE OR REPLACE FUNCTION public.track_customer_location_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_valid_point boolean;
  coords_changed boolean;
BEGIN
  has_valid_point :=
    NEW.latitude IS NOT NULL
    AND NEW.longitude IS NOT NULL
    AND NEW.latitude BETWEEN -90 AND 90
    AND NEW.longitude BETWEEN -180 AND 180
    AND NOT (NEW.latitude = 0 AND NEW.longitude = 0);

  IF TG_OP = 'INSERT' THEN
    IF has_valid_point AND NEW.location_source IS NULL THEN
      NEW.location_source := 'explicit_entry';
      NEW.location_verified_at := COALESCE(NEW.location_verified_at, now());
    ELSIF NOT has_valid_point AND NEW.location_source IS NULL THEN
      NEW.location_source := 'missing';
      NEW.location_verified_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  coords_changed :=
    NEW.latitude IS DISTINCT FROM OLD.latitude
    OR NEW.longitude IS DISTINCT FROM OLD.longitude;

  IF coords_changed THEN
    IF has_valid_point THEN
      -- Preserve a source explicitly supplied by system repair logic.
      IF NEW.location_source IS NOT DISTINCT FROM OLD.location_source THEN
        NEW.location_source := 'explicit_update';
      END IF;
      NEW.location_verified_at := COALESCE(NEW.location_verified_at, now());
    ELSE
      NEW.location_source := 'missing';
      NEW.location_verified_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS track_customer_location_metadata ON public.customers;
CREATE TRIGGER track_customer_location_metadata
BEFORE INSERT OR UPDATE OF latitude, longitude, location_source, location_verified_at
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.track_customer_location_metadata();

CREATE OR REPLACE FUNCTION public.enforce_delivery_gps_on_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_lat double precision;
  target_lng double precision;
  distance_m double precision;
  is_plant_pickup boolean;
  customer_location_source text;
BEGIN
  IF NEW.status = 'delivered'
     AND OLD.status IS DISTINCT FROM 'delivered' THEN

    -- Superadmin administrative override remains OTP-protected and bypasses GPS.
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

      SELECT
        c.latitude::double precision,
        c.longitude::double precision,
        c.location_source
      INTO target_lat, target_lng, customer_location_source
      FROM public.customers c
      WHERE c.id = NEW.customer_id;

      -- One-time recovery path for the corrupted legacy location cluster.
      IF customer_location_source = 'legacy_suspect' THEN
        IF NEW.delivery_accuracy_m IS NULL OR NEW.delivery_accuracy_m > 150 THEN
          RAISE EXCEPTION 'GPS_ACCURACY_REQUIRED_FOR_LEGACY_LOCATION'
            USING ERRCODE = '23514',
                  DETAIL = 'Legacy customer location repair requires precise GPS (150 m accuracy or better).';
        END IF;

        UPDATE public.customers
        SET latitude = NEW.delivery_latitude,
            longitude = NEW.delivery_longitude,
            location_source = 'driver_delivery_gps',
            location_verified_at = now(),
            updated_at = now()
        WHERE id = NEW.customer_id;

        NEW.delivery_distance_m := 0;
        NEW.delivery_confirmation_source := 'driver_gps';
        NEW.delivery_confirmation_note :=
          'Entregado por repartidor con GPS preciso. Se corrigió automáticamente una ubicación histórica no confiable del cliente.';

        INSERT INTO public.logs(action, entity, entity_id, company_id, details)
        VALUES (
          'legacy_customer_location_reanchored_by_driver',
          'customers',
          NEW.customer_id,
          NEW.company_id,
          jsonb_build_object(
            'order_id', NEW.id,
            'customer_name', NEW.customer_name,
            'repartidor_name', NEW.repartidor_name,
            'new_latitude', NEW.delivery_latitude,
            'new_longitude', NEW.delivery_longitude,
            'gps_accuracy_m', NEW.delivery_accuracy_m,
            'reason', 'Legacy suspect location replaced during confirmed physical delivery.'
          )
        );
      ELSE
        -- Normal customers continue to use the strict 200 m geofence.
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
        NEW.delivery_confirmation_source := 'driver_gps';
        NEW.delivery_confirmation_note := 'Entregado por repartidor con validación GPS dentro de 200 m.';
      END IF;
    ELSE
      NEW.delivery_distance_m := NULL;
      NEW.delivery_confirmation_source := 'plant_pickup';
      NEW.delivery_confirmation_note := 'Entregado como recojo en planta.';
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
  'Normal deliveries require <=200m. Legacy-suspect customer locations are re-anchored once using precise repartidor GPS, then become normal verified locations. Superadmin OTP and plant pickup rules are preserved.';

NOTIFY pgrst, 'reload schema';
