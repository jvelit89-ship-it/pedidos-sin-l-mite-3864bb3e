-- Required by the atomic PIN + GPS delivery confirmation flow.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin_verified_at timestamptz;

COMMENT ON COLUMN public.orders.delivery_pin_verified_at IS
  'Timestamp when the customer delivery PIN was verified for the final GPS-backed delivery confirmation';

NOTIFY pgrst, 'reload schema';
