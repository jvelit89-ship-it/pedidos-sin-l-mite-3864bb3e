-- Índices aditivos para acelerar consultas frecuentes de clientes, pedidos e inventario.
-- No modifican datos ni cambian lógica de negocio.

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
  ON public.orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_company_created_at
  ON public.orders (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_company_status_created_at
  ON public.orders (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_customers_company_name
  ON public.customers (company_id, name);

CREATE INDEX IF NOT EXISTS idx_production_recipes_company_output_active
  ON public.production_recipes (company_id, output_product_id, is_active);
