-- Seller delivery acknowledgement and observation workflow.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_delivery_review_status text,
  ADD COLUMN IF NOT EXISTS seller_delivery_observation text,
  ADD COLUMN IF NOT EXISTS seller_delivery_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_delivery_reviewed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS seller_delivery_reviewed_by_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_seller_delivery_review_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_seller_delivery_review_status_check
      CHECK (
        seller_delivery_review_status IS NULL
        OR seller_delivery_review_status IN ('conforme', 'observado')
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.seller_review_delivery(
  p_order_id uuid,
  p_status text,
  p_observation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_vendedor_id uuid;
  current_vendedor_name text;
  target_order public.orders%ROWTYPE;
  cleaned_observation text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED'
      USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('conforme', 'observado') THEN
    RAISE EXCEPTION 'INVALID_REVIEW_STATUS'
      USING ERRCODE = '22023';
  END IF;

  cleaned_observation := NULLIF(trim(coalesce(p_observation, '')), '');

  IF p_status = 'observado' AND cleaned_observation IS NULL THEN
    RAISE EXCEPTION 'OBSERVATION_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT v.id, v.name
    INTO current_vendedor_id, current_vendedor_name
  FROM public.vendedores v
  WHERE v.user_id = current_user_id
    AND coalesce(v.active, true) = true
  LIMIT 1;

  IF current_vendedor_id IS NULL THEN
    RAISE EXCEPTION 'SELLER_PROFILE_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO target_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF target_order.vendedor_id IS DISTINCT FROM current_vendedor_id THEN
    RAISE EXCEPTION 'NOT_ORDER_SELLER'
      USING ERRCODE = '42501';
  END IF;

  IF target_order.status <> 'delivered'::public.order_status THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET seller_delivery_review_status = p_status,
      seller_delivery_observation = cleaned_observation,
      seller_delivery_reviewed_at = now(),
      seller_delivery_reviewed_by_user_id = current_user_id,
      seller_delivery_reviewed_by_name = current_vendedor_name,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.logs(action, entity, entity_id, company_id, user_id, details)
  VALUES (
    'seller_delivery_review',
    'orders',
    p_order_id,
    target_order.company_id,
    current_user_id,
    jsonb_build_object(
      'customer_name', target_order.customer_name,
      'vendedor_id', current_vendedor_id,
      'vendedor_name', current_vendedor_name,
      'review_status', p_status,
      'observation', cleaned_observation,
      'delivery_confirmation_source', target_order.delivery_confirmation_source,
      'delivered_at', target_order.delivered_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'review_status', p_status,
    'observation', cleaned_observation,
    'reviewed_at', now(),
    'reviewed_by', current_vendedor_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.seller_review_delivery(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_review_delivery(uuid, text, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_orders_seller_delivery_review_pending
  ON public.orders (vendedor_id, delivered_at DESC)
  WHERE status = 'delivered'::public.order_status
    AND seller_delivery_reviewed_at IS NULL;

COMMENT ON FUNCTION public.seller_review_delivery(uuid, text, text) IS
  'Allows only the assigned seller to acknowledge a delivered order as conforme or observado and records an audit log.';

NOTIFY pgrst, 'reload schema';
