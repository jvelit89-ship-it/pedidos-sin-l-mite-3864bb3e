-- Add columns to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS document_id TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_document_id_company ON public.customers (document_id, company_id);

-- Add columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'manual';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_factory_direct BOOLEAN DEFAULT false;

-- Add salesperson selection to orders if not present (it is present as vendedor_id)

-- Update RLS for customers to allow public lookup by document_id
CREATE POLICY "Public can lookup customers by document_id" 
ON public.customers 
FOR SELECT 
TO anon
USING (true); -- We will filter by company_id and document_id in the application logic

CREATE POLICY "Public can insert/update their own customer data" 
ON public.customers 
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Update RLS for orders to allow public insertion
GRANT INSERT ON public.orders TO anon;
GRANT SELECT ON public.orders TO anon; -- Allow them to see their created order? Maybe just by ID.

CREATE POLICY "Public can create orders" 
ON public.orders 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Update RLS for order_items
GRANT INSERT ON public.order_items TO anon;
CREATE POLICY "Public can create order items" 
ON public.order_items 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Allow public to see products
GRANT SELECT ON public.products TO anon;
CREATE POLICY "Public can view products" 
ON public.products 
FOR SELECT 
TO anon
USING (true);

-- Allow public to see vendedores (to choose one)
GRANT SELECT ON public.vendedores TO anon;
CREATE POLICY "Public can view vendedores" 
ON public.vendedores 
FOR SELECT 
TO anon
USING (active = true);

-- Allow public to see companies (to get info)
GRANT SELECT ON public.companies TO anon;
CREATE POLICY "Public can view companies" 
ON public.companies 
FOR SELECT 
TO anon
USING (true);
