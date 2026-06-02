CREATE OR REPLACE FUNCTION public.verify_order_pin(p_order_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_correct_pin TEXT;
BEGIN
    -- Check if a PIN exists for this order
    SELECT pin INTO v_correct_pin
    FROM public.order_delivery_pins
    WHERE order_id = p_order_id;
    
    -- If no PIN exists, we allow the delivery (for legacy orders)
    IF v_correct_pin IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Compare the provided PIN
    RETURN v_correct_pin = p_pin;
END;
$$;
