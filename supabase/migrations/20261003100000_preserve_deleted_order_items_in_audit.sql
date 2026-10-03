-- Preserve a complete snapshot of deleted orders before ON DELETE CASCADE
-- removes their order_items. Existing audit rows remain untouched.
CREATE OR REPLACE FUNCTION public.log_order_delete_with_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  current_user_name TEXT;
  item_snapshot JSONB;
BEGIN
  current_user_id := auth.uid();

  SELECT name
    INTO current_user_name
    FROM public.profiles
   WHERE user_id = current_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(oi) ORDER BY oi.id), '[]'::jsonb)
    INTO item_snapshot
    FROM public.order_items oi
   WHERE oi.order_id = OLD.id;

  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    company_id
  )
  VALUES (
    current_user_id,
    current_user_name,
    'orders',
    OLD.id,
    'DELETE',
    to_jsonb(OLD) || jsonb_build_object('order_items', item_snapshot),
    NULL,
    OLD.company_id
  );

  RETURN OLD;
END;
$function$;

-- Keep the generic audit trigger for inserts/updates only.
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_audit();

-- Capture order + items before the parent delete cascades to order_items.
DROP TRIGGER IF EXISTS audit_orders_delete ON public.orders;
CREATE TRIGGER audit_orders_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_delete_with_items();
