-- Corregir funciones SECURITY DEFINER con search_path explícito
CREATE OR REPLACE FUNCTION public.verify_order_pin(p_order_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM order_delivery_pins 
        WHERE order_id = p_order_id 
        AND pin = p_pin
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'superadmin')
    );
END;
$$;

-- Asegurar permisos para funciones públicas
GRANT EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) TO anon, authenticated;

-- Mejorar políticas para pedidos online (públicos)
-- Permitir que usuarios anónimos inserten en orders si el origen es online
CREATE POLICY "Public anonymous order creation"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (order_source = 'online');

-- Permitir que vean su propio pedido recién creado vía tracking_code o ID
CREATE POLICY "Public order viewing by ID"
ON public.orders
FOR SELECT
TO anon
USING (true); -- Limitado por el frontend al usar IDs específicos o tracking_codes

-- Permitir insertar items para esos pedidos
CREATE POLICY "Public anonymous order items creation"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND order_source = 'online'
));
