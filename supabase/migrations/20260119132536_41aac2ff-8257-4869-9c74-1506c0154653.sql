-- Allow vendedores to create customers in their company
CREATE POLICY "Vendedor can create customers"
ON public.customers
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'vendedor'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- Allow vendedores to update customers in their company
CREATE POLICY "Vendedor can update customers"
ON public.customers
FOR UPDATE
USING (
  has_role(auth.uid(), 'vendedor'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);