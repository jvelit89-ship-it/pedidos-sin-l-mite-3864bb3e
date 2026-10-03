-- Audit delivery PIN notifications without storing the PIN itself.
CREATE TABLE IF NOT EXISTS public.delivery_pin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted', 'sent', 'delivered', 'failed')),
  destination_masked text,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_pin_notifications_order_idx
  ON public.delivery_pin_notifications (order_id, created_at DESC);

ALTER TABLE public.delivery_pin_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.delivery_pin_notifications FROM anon;
REVOKE ALL ON TABLE public.delivery_pin_notifications FROM authenticated;
REVOKE ALL ON TABLE public.delivery_pin_notifications FROM PUBLIC;

COMMENT ON TABLE public.delivery_pin_notifications IS
  'Server-only audit trail for delivery PIN notifications. The PIN value is never stored here.';

NOTIFY pgrst, 'reload schema';
