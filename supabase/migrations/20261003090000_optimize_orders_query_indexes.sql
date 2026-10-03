-- Performance indexes for operational order loading after self-host migration.
CREATE INDEX IF NOT EXISTS idx_orders_company_status_created_at
  ON public.orders (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_company_created_at
  ON public.orders (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_company_delivered_at
  ON public.orders (company_id, delivered_at DESC)
  WHERE delivered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);
