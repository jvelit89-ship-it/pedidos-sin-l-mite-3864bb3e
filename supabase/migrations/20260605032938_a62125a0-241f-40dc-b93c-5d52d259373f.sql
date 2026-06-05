-- Setting search_path to 'public' for SECURITY DEFINER functions
-- This is a critical security best practice to prevent search_path hijacking

ALTER FUNCTION public.get_user_company_id(UUID) SET search_path = public;
ALTER FUNCTION public.has_role(UUID, public.user_role) SET search_path = public;
ALTER FUNCTION public.validate_customer_document() SET search_path = public;
ALTER FUNCTION public.set_order_item_company_id() SET search_path = public;
ALTER FUNCTION public.auto_deduct_stock_on_waste() SET search_path = public;
ALTER FUNCTION public.reserve_stock_on_order_item() SET search_path = public;
ALTER FUNCTION public.update_stock_on_purchase_item() SET search_path = public;
ALTER FUNCTION public.recalculate_company_stock(UUID) SET search_path = public;
ALTER FUNCTION public.recalculate_my_company_stock() SET search_path = public;
ALTER FUNCTION public.revert_stock_on_purchase_cancel() SET search_path = public;
ALTER FUNCTION public.release_reserved_stock_on_item_delete() SET search_path = public;
ALTER FUNCTION public.deduct_stock_on_order_item() SET search_path = public;
ALTER FUNCTION public.adjust_reserved_stock_on_item_update() SET search_path = public;
ALTER FUNCTION public.deduct_stock_on_delivery() SET search_path = public;
ALTER FUNCTION public.auto_assign_vendedor_on_order() SET search_path = public;
ALTER FUNCTION public.set_order_created_by() SET search_path = public;

-- Revoke public execute on helper functions
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.user_role) TO authenticated, service_role;
