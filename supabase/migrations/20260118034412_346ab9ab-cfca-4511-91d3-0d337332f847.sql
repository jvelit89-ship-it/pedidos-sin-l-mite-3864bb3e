-- Add tracking_code column to orders for public tracking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;

-- Generate tracking codes for existing orders
UPDATE public.orders 
SET tracking_code = UPPER(SUBSTRING(MD5(id::text || created_at::text) FROM 1 FOR 8))
WHERE tracking_code IS NULL;

-- Create function to auto-generate tracking code on insert
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text || RANDOM()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating tracking code
DROP TRIGGER IF EXISTS set_tracking_code ON public.orders;
CREATE TRIGGER set_tracking_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_code();

-- Create a public view for order tracking (limited fields for security)
CREATE OR REPLACE VIEW public.order_tracking
WITH (security_invoker = off) AS
SELECT 
  o.id,
  o.tracking_code,
  o.customer_name,
  o.delivery_address,
  o.status,
  o.total,
  o.created_at,
  o.updated_at,
  o.delivered_at,
  o.repartidor_name,
  c.phone as customer_phone
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

-- Grant select on the view to anon role for public access
GRANT SELECT ON public.order_tracking TO anon;

-- Create customer order history view
CREATE OR REPLACE VIEW public.customer_order_history
WITH (security_invoker = off) AS
SELECT 
  o.id,
  o.tracking_code,
  o.customer_name,
  o.customer_id,
  o.status,
  o.total,
  o.created_at,
  o.delivered_at,
  c.phone as customer_phone
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

-- Grant select on history view to anon role
GRANT SELECT ON public.customer_order_history TO anon;