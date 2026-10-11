-- Ensure commissions can resolve historical/current orders to active vendedores.
-- Some legacy orders kept vendedor_name but had vendedor_id = NULL, so the
-- commission hooks could not attribute those sales to the seller.

WITH matched AS (
  SELECT
    o.id AS order_id,
    v.id AS vendedor_id
  FROM public.orders o
  JOIN public.vendedores v
    ON v.company_id = o.company_id
   AND coalesce(v.active, true) = true
   AND regexp_replace(lower(trim(v.name)), '\s+', '', 'g')
       = regexp_replace(lower(trim(coalesce(o.vendedor_name, ''))), '\s+', '', 'g')
  WHERE o.vendedor_id IS NULL
    AND nullif(trim(coalesce(o.vendedor_name, '')), '') IS NOT NULL
)
UPDATE public.orders o
SET vendedor_id = m.vendedor_id,
    updated_at = now()
FROM matched m
WHERE o.id = m.order_id;

CREATE OR REPLACE FUNCTION public.sync_order_vendedor_id_from_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resolved_vendedor_id uuid;
BEGIN
  IF NEW.vendedor_id IS NOT NULL
     OR nullif(trim(coalesce(NEW.vendedor_name, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.id
    INTO resolved_vendedor_id
  FROM public.vendedores v
  WHERE v.company_id = NEW.company_id
    AND coalesce(v.active, true) = true
    AND regexp_replace(lower(trim(v.name)), '\s+', '', 'g')
        = regexp_replace(lower(trim(NEW.vendedor_name)), '\s+', '', 'g')
  LIMIT 1;

  IF resolved_vendedor_id IS NOT NULL THEN
    NEW.vendedor_id := resolved_vendedor_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_order_vendedor_id_from_name ON public.orders;
CREATE TRIGGER sync_order_vendedor_id_from_name
BEFORE INSERT OR UPDATE OF vendedor_id, vendedor_name, company_id
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_vendedor_id_from_name();

COMMENT ON FUNCTION public.sync_order_vendedor_id_from_name() IS
  'Backfills vendedor_id from an exact normalized active vendedor name so commission calculations never lose seller-attributed orders.';

NOTIFY pgrst, 'reload schema';
