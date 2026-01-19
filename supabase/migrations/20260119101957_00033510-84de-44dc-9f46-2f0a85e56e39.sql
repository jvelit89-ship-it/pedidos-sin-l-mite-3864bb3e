-- Allow operario to update orders status in their company
CREATE POLICY "Operario can update orders status"
ON public.orders
FOR UPDATE
USING (
  has_role(auth.uid(), 'operario'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);