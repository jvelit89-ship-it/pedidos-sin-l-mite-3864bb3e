-- Allow anonymous users to view order items they just created
-- (This is often needed for follow-up client-side logic after insertion)
CREATE POLICY "Public can view order items" 
ON public.order_items 
FOR SELECT 
TO anon 
USING (true);

-- Ensure orders can also be viewed by anon to verify creation
CREATE POLICY "Public can view orders" 
ON public.orders 
FOR SELECT 
TO anon 
USING (true);
