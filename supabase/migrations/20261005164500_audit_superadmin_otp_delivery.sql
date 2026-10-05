-- Record how a delivery was completed so Superadmin OTP overrides are explicit and auditable.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_confirmation_source text,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by_email text,
  ADD COLUMN IF NOT EXISTS delivery_confirmation_note text;

COMMENT ON COLUMN public.orders.delivery_confirmation_source IS
  'How delivery was confirmed: driver_gps, plant_pickup, or superadmin_otp.';
COMMENT ON COLUMN public.orders.delivery_confirmation_note IS
  'Human-readable audit note explaining how the delivery was completed.';

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

    -- Administrative completion is only enabled from the OTP-protected RPC.
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

      -- Current customer coordinates are the source of truth.
      SELECT c.latitude::double precision, c.longitude::double precision
        INTO target_lat, target_lng
      FROM public.customers c
      WHERE c.id = NEW.customer_id
        AND c.latitude IS NOT NULL
        AND c.longitude IS NOT NULL
        AND c.latitude BETWEEN -90 AND 90
        AND c.longitude BETWEEN -180 AND 180
        AND NOT (c.latitude = 0 AND c.longitude = 0);

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

CREATE OR REPLACE FUNCTION public.otp_superadmin_change_order_status(
  p_order_ids uuid[],
  p_status public.order_status
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changed_count integer;
BEGIN
  PERFORM set_config('app.superadmin_otp_override', 'on', true);

  UPDATE public.orders
  SET status = p_status,
      updated_at = now(),
      delivered_at = CASE
        WHEN p_status = 'delivered'::public.order_status THEN COALESCE(delivered_at, now())
        ELSE NULL
      END,
      delivery_confirmation_source = CASE
        WHEN p_status = 'delivered'::public.order_status THEN 'superadmin_otp'
        ELSE NULL
      END,
      delivery_confirmation_note = CASE
        WHEN p_status = 'delivered'::public.order_status
          THEN 'Entregado manualmente por Superadmin mediante autorización OTP para apoyar la operación de reparto.'
        ELSE NULL
      END,
      delivery_confirmed_by_user_id = CASE
        WHEN p_status = 'delivered'::public.order_status THEN delivery_confirmed_by_user_id
        ELSE NULL
      END,
      delivery_confirmed_by_email = CASE
        WHEN p_status = 'delivered'::public.order_status THEN delivery_confirmed_by_email
        ELSE NULL
      END
  WHERE id = ANY(p_order_ids);

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  PERFORM set_config('app.superadmin_otp_override', 'off', true);
  RETURN changed_count;
END;
$function$;

COMMENT ON FUNCTION public.otp_superadmin_change_order_status(uuid[], public.order_status) IS
  'OTP-protected Superadmin status override. Delivered orders are explicitly tagged as superadmin_otp.';

NOTIFY pgrst, 'reload schema';
