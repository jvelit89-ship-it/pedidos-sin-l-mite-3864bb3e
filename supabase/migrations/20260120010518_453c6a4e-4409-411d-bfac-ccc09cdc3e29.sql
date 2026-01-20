-- Add policy to allow operarios to update product stock
CREATE POLICY "Operario can update product stock"
ON public.products
FOR UPDATE
USING (
  has_role(auth.uid(), 'operario'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Also allow operarios to insert stock movements (needed for production tracking)
CREATE POLICY "Operario can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'operario'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);