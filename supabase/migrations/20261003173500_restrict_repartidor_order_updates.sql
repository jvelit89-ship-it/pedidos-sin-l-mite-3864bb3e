-- Restrict repartidores to rows explicitly assigned to their own repartidor record.
DROP POLICY IF EXISTS "Repartidor can update assigned orders" ON public.orders;

CREATE POLICY "Repartidor can update assigned orders"
ON public.orders
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'repartidor'::user_role)
  AND company_id = get_user_company_id(auth.uid())
  AND repartidor_id = (
    SELECT r.id
    FROM public.repartidores r
    WHERE r.user_id = auth.uid()
      AND r.active = true
    LIMIT 1
  )
)
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND repartidor_id = (
    SELECT r.id
    FROM public.repartidores r
    WHERE r.user_id = auth.uid()
      AND r.active = true
    LIMIT 1
  )
);
