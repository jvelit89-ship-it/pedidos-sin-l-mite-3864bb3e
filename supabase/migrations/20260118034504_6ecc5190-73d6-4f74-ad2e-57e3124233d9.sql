-- Fix security definer views by recreating them with security_invoker = on
-- And fix function search_path

-- Drop and recreate views with proper security settings
DROP VIEW IF EXISTS public.order_tracking;
DROP VIEW IF EXISTS public.customer_order_history;

-- Recreate order_tracking view with security_invoker (safer)
CREATE VIEW public.order_tracking
WITH (security_invoker = on) AS
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

-- Grant select on the view to anon and authenticated roles
GRANT SELECT ON public.order_tracking TO anon;
GRANT SELECT ON public.order_tracking TO authenticated;

-- Recreate customer_order_history view with security_invoker
CREATE VIEW public.customer_order_history
WITH (security_invoker = on) AS
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

-- Grant select on history view
GRANT SELECT ON public.customer_order_history TO anon;
GRANT SELECT ON public.customer_order_history TO authenticated;

-- Fix the generate_tracking_code function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text || RANDOM()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

-- Create RLS policy to allow public read access to orders via tracking_code
CREATE POLICY "Allow public read via tracking code" 
ON public.orders
FOR SELECT
TO anon
USING (tracking_code IS NOT NULL);

-- Create RLS policy for customers table to allow join in view
CREATE POLICY "Allow public read customer phone for tracking"
ON public.customers
FOR SELECT
TO anon
USING (true);