-- Persistent "seller needs to review this delivery" marker.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_delivery_review_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_seller_delivery_review()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'delivered'::public.order_status
     AND OLD.status IS DISTINCT FROM 'delivered'::public.order_status
     AND NEW.vendedor_id IS NOT NULL THEN
    NEW.seller_delivery_review_requested_at := COALESCE(
      NEW.seller_delivery_review_requested_at,
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS request_seller_delivery_review ON public.orders;
CREATE TRIGGER request_seller_delivery_review
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.request_seller_delivery_review();

-- Only today's already-delivered orders are queued so the new feature starts
-- useful without forcing sellers to review the entire historical archive.
UPDATE public.orders
SET seller_delivery_review_requested_at = COALESCE(
  seller_delivery_review_requested_at,
  delivered_at,
  now()
)
WHERE status = 'delivered'::public.order_status
  AND vendedor_id IS NOT NULL
  AND seller_delivery_reviewed_at IS NULL
  AND delivered_at >= (
    date_trunc('day', now() AT TIME ZONE 'America/Lima')
    AT TIME ZONE 'America/Lima'
  );

CREATE INDEX IF NOT EXISTS idx_orders_seller_review_requested
  ON public.orders (vendedor_id, seller_delivery_review_requested_at DESC)
  WHERE seller_delivery_review_requested_at IS NOT NULL
    AND seller_delivery_reviewed_at IS NULL;

COMMENT ON COLUMN public.orders.seller_delivery_review_requested_at IS
  'Timestamp when the assigned seller was asked to acknowledge/review a completed delivery.';

NOTIFY pgrst, 'reload schema';
