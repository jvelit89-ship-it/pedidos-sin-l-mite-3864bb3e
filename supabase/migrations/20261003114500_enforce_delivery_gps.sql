-- Prevent any future delivery completion without a real GPS proof.
-- Existing historical delivered rows without GPS are left untouched.
CREATE OR REPLACE FUNCTION public.enforce_delivery_gps_on_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'delivered'
     AND OLD.status IS DISTINCT FROM 'delivered' THEN

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
