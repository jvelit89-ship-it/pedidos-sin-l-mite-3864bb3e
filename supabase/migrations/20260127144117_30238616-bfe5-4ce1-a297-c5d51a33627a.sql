-- Fix linter issues introduced/detected: make views run with invoker security

CREATE OR REPLACE VIEW public.customer_order_history
WITH (security_invoker=on) AS
SELECT
  o.id,
  o.customer_id,
  o.customer_name,
  c.phone AS customer_phone,
  o.total,
  o.status,
  o.tracking_code,
  o.created_at,
  o.delivered_at
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

CREATE OR REPLACE VIEW public.order_tracking
WITH (security_invoker=on) AS
SELECT
  o.id,
  o.customer_name,
  c.phone AS customer_phone,
  o.delivery_address,
  o.total,
  o.status,
  o.tracking_code,
  o.repartidor_name,
  o.created_at,
  o.updated_at,
  o.delivered_at
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

-- Tighten overly-permissive RLS on distributor_empty_containers
DROP POLICY IF EXISTS "Public can insert empty containers" ON public.distributor_empty_containers;
DROP POLICY IF EXISTS "Public can view own empty containers" ON public.distributor_empty_containers;

CREATE POLICY "Public can insert empty containers (scoped)"
ON public.distributor_empty_containers
FOR INSERT
WITH CHECK (
  company_id = (
    SELECT company_id
    FROM public.customers
    WHERE id = customer_id
  )
);

CREATE POLICY "Company users can view empty containers"
ON public.distributor_empty_containers
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
);
