-- Create a table for delivery PINs
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Copy existing PINs
INSERT INTO public.order_delivery_pins (order_id, pin)
SELECT id, delivery_pin 
FROM public.orders 
WHERE delivery_pin IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

-- Drop the column from orders table
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_pin;

-- Enable RLS
ALTER TABLE public.order_delivery_pins ENABLE ROW LEVEL SECURITY;

-- Permissions for order_delivery_pins
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_delivery_pins TO authenticated;
GRANT ALL ON public.order_delivery_pins TO service_role;

-- Policies for order_delivery_pins
CREATE POLICY "Admins can manage delivery pins"
ON public.order_delivery_pins
FOR ALL
USING (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'superadmin'::user_role)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'superadmin'::user_role)
);

-- For Vendedores: they can insert PINs when creating orders
CREATE POLICY "Vendedores can insert delivery pins"
ON public.order_delivery_pins
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'vendedor'::user_role)
);

-- Secure RPC function to verify PIN
CREATE OR REPLACE FUNCTION public.verify_order_pin(p_order_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator privileges (can read order_delivery_pins)
SET search_path = public
AS $$
DECLARE
    v_correct_pin TEXT;
BEGIN
    SELECT pin INTO v_correct_pin
    FROM public.order_delivery_pins
    WHERE order_id = p_order_id;
    
    RETURN v_correct_pin = p_pin;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) TO authenticated;
