
DROP POLICY IF EXISTS "Public can insert/update their own customer data" ON public.customers;
DROP POLICY IF EXISTS "Public can lookup customers by document_id" ON public.customers;

DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public order viewing by ID" ON public.orders;
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Public can create order items" ON public.order_items;

DROP POLICY IF EXISTS "Public can view products" ON public.products;

DROP VIEW IF EXISTS public.public_products_view;
CREATE VIEW public.public_products_view
WITH (security_invoker = false) AS
SELECT id, company_id, name, price, stock, image_url, product_type
FROM public.products;
GRANT SELECT ON public.public_products_view TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view vendedores" ON public.vendedores;

DROP VIEW IF EXISTS public.public_vendedores_view;
CREATE VIEW public.public_vendedores_view
WITH (security_invoker = false) AS
SELECT id, company_id, name
FROM public.vendedores
WHERE active = true;
GRANT SELECT ON public.public_vendedores_view TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can insert operarios" ON public.operarios;
DROP POLICY IF EXISTS "Admins can update operarios" ON public.operarios;
DROP POLICY IF EXISTS "Admins can delete operarios" ON public.operarios;

CREATE POLICY "Admins can insert operarios in their company"
ON public.operarios FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can update operarios in their company"
ON public.operarios FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND company_id = public.get_user_company_id(auth.uid())
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can delete operarios in their company"
ON public.operarios FOR DELETE TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND company_id = public.get_user_company_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage delivery pins" ON public.order_delivery_pins;

CREATE POLICY "Admins can manage delivery pins in their company"
ON public.order_delivery_pins FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_delivery_pins.order_id
      AND o.company_id = public.get_user_company_id(auth.uid())
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_delivery_pins.order_id
      AND o.company_id = public.get_user_company_id(auth.uid())
  )
);

DROP VIEW IF EXISTS public.order_tracking;
DROP VIEW IF EXISTS public.customer_order_history;
