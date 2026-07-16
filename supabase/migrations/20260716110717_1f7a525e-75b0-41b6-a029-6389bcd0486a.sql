-- Add distance column to orders for successful deliveries
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_distance_m NUMERIC;

-- Table to log every attempt to mark delivered outside allowed radius (blocked)
CREATE TABLE IF NOT EXISTS public.delivery_location_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id UUID,
  repartidor_id UUID,
  repartidor_name TEXT,
  customer_name TEXT,
  customer_lat NUMERIC,
  customer_lng NUMERIC,
  driver_lat NUMERIC,
  driver_lng NUMERIC,
  distance_m NUMERIC,
  blocked BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.delivery_location_attempts TO authenticated;
GRANT ALL ON public.delivery_location_attempts TO service_role;

ALTER TABLE public.delivery_location_attempts ENABLE ROW LEVEL SECURITY;

-- Any authenticated user in same company can insert their own attempt
CREATE POLICY "Users can insert their own attempts"
ON public.delivery_location_attempts
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Admins/superadmins see everything in their company
CREATE POLICY "Admins view company attempts"
ON public.delivery_location_attempts
FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::public.user_role)
       OR public.has_role(auth.uid(), 'superadmin'::public.user_role))
);

CREATE INDEX IF NOT EXISTS idx_delivery_location_attempts_company_date
  ON public.delivery_location_attempts (company_id, created_at DESC);