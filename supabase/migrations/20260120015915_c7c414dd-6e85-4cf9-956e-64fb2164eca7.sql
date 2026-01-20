-- Drop views that depend on the columns we're modifying
DROP VIEW IF EXISTS public.customer_order_history;
DROP VIEW IF EXISTS public.order_tracking;

-- Update price columns to support 4 decimal places

-- Products table
ALTER TABLE public.products 
  ALTER COLUMN price TYPE numeric(12, 4),
  ALTER COLUMN commission_amount TYPE numeric(12, 4),
  ALTER COLUMN operario_commission_amount TYPE numeric(12, 4);

-- Volume pricing rules
ALTER TABLE public.volume_pricing_rules 
  ALTER COLUMN unit_price TYPE numeric(12, 4);

-- Distributor credits
ALTER TABLE public.distributor_credits 
  ALTER COLUMN amount_paid TYPE numeric(12, 4);

-- Order items
ALTER TABLE public.order_items 
  ALTER COLUMN unit_price TYPE numeric(12, 4),
  ALTER COLUMN total TYPE numeric(12, 4);

-- Orders total
ALTER TABLE public.orders 
  ALTER COLUMN total TYPE numeric(12, 4);

-- Commission payments
ALTER TABLE public.commission_payments 
  ALTER COLUMN total_amount TYPE numeric(12, 4);

-- Recreate the customer_order_history view
CREATE VIEW public.customer_order_history AS
SELECT 
  o.id,
  o.customer_id,
  o.customer_name,
  c.phone as customer_phone,
  o.total,
  o.status,
  o.tracking_code,
  o.created_at,
  o.delivered_at
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

-- Recreate the order_tracking view
CREATE VIEW public.order_tracking AS
SELECT 
  o.id,
  o.customer_name,
  c.phone as customer_phone,
  o.delivery_address,
  o.total,
  o.status,
  o.tracking_code,
  o.repartidor_name,
  o.created_at,
  o.updated_at,
  o.delivered_at
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;