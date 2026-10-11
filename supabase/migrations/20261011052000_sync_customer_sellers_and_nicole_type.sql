-- Synchronize customer classification and seller ownership.
UPDATE public.customers
SET customer_type='distribuidor'::public.customer_type, updated_at=now()
WHERE id='7a4ba222-eaf6-4bd8-bf2e-67f836158de6'::uuid
  AND customer_type IS DISTINCT FROM 'distribuidor'::public.customer_type;

WITH latest_order AS (
  SELECT DISTINCT ON (o.customer_id)
    o.customer_id,o.company_id,o.vendedor_id,o.vendedor_name,
    coalesce(o.delivered_at,o.created_at) AS order_at
  FROM public.orders o
  WHERE o.status<>'cancelled'::public.order_status
    AND o.customer_id IS NOT NULL
  ORDER BY o.customer_id,coalesce(o.delivered_at,o.created_at) DESC,o.created_at DESC
),
resolved AS (
  SELECT c.id AS customer_id,
         coalesce(lo.vendedor_id,v.id) AS resolved_vendedor_id
  FROM public.customers c
  JOIN latest_order lo ON lo.customer_id=c.id AND lo.company_id=c.company_id
  LEFT JOIN public.vendedores v
    ON lo.vendedor_id IS NULL
   AND v.company_id=c.company_id
   AND coalesce(v.active,true)=true
   AND regexp_replace(lower(trim(v.name)),'\s+','','g')
       =regexp_replace(lower(trim(coalesce(lo.vendedor_name,''))),'\s+','','g')
  WHERE c.vendedor_id IS NULL
    AND coalesce(lo.vendedor_id,v.id) IS NOT NULL
)
UPDATE public.customers c
SET vendedor_id=r.resolved_vendedor_id, updated_at=now()
FROM resolved r
WHERE c.id=r.customer_id;

CREATE OR REPLACE FUNCTION public.sync_customer_seller_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE resolved_vendedor_id uuid;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.status='cancelled'::public.order_status THEN
    RETURN NEW;
  END IF;

  IF NEW.vendedor_id IS NOT NULL THEN
    resolved_vendedor_id:=NEW.vendedor_id;
  ELSIF nullif(trim(coalesce(NEW.vendedor_name,'')),'') IS NOT NULL THEN
    SELECT v.id INTO resolved_vendedor_id
    FROM public.vendedores v
    WHERE v.company_id=NEW.company_id
      AND coalesce(v.active,true)=true
      AND regexp_replace(lower(trim(v.name)),'\s+','','g')
          =regexp_replace(lower(trim(NEW.vendedor_name)),'\s+','','g')
    LIMIT 1;
  END IF;

  IF resolved_vendedor_id IS NOT NULL THEN
    UPDATE public.customers
    SET vendedor_id=resolved_vendedor_id, updated_at=now()
    WHERE id=NEW.customer_id
      AND company_id=NEW.company_id
      AND vendedor_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_customer_seller_from_order ON public.orders;
CREATE TRIGGER sync_customer_seller_from_order
AFTER INSERT OR UPDATE OF customer_id,vendedor_id,vendedor_name,status
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_seller_from_order();

NOTIFY pgrst,'reload schema';
