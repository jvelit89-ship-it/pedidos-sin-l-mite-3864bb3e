-- Make delivery PINs server-only and impossible to reveal to normal app users.
ALTER TABLE public.order_delivery_pins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_delivery_pins FROM anon;
REVOKE ALL ON TABLE public.order_delivery_pins FROM authenticated;
REVOKE ALL ON TABLE public.order_delivery_pins FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.verify_order_pin(
  p_order_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_delivery_pins odp
    JOIN public.orders o ON o.id = odp.order_id
    WHERE odp.order_id = p_order_id
      AND odp.pin = p_pin
      AND o.company_id = public.get_user_company_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'superadmin'::public.user_role)
        OR public.has_role(auth.uid(), 'admin'::public.user_role)
        OR (
          public.has_role(auth.uid(), 'repartidor'::public.user_role)
          AND o.repartidor_id = (
            SELECT r.id
            FROM public.repartidores r
            WHERE r.user_id = auth.uid()
              AND r.active = true
            LIMIT 1
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.verify_order_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_order_pin(uuid, text) TO authenticated;

REVOKE ALL ON TABLE public.reveal_pin_otp_codes FROM anon;
REVOKE ALL ON TABLE public.reveal_pin_otp_codes FROM authenticated;
REVOKE ALL ON TABLE public.reveal_pin_otp_codes FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
