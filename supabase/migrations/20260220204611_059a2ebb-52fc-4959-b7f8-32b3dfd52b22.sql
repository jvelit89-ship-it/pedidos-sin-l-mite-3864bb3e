
-- =============================================
-- PART 1: BACKORDERS - Add backorder to order_status enum
-- =============================================

-- Add 'backorder' to the existing order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'backorder';

-- =============================================
-- PART 2: PREPAID PACKAGES tables
-- =============================================

CREATE TABLE IF NOT EXISTS public.customer_prepaid_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  total_units integer NOT NULL,
  remaining_units integer NOT NULL,
  unit_price numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at date
);

ALTER TABLE public.customer_prepaid_packages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.prepaid_package_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES public.customer_prepaid_packages(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  quantity_used integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prepaid_package_usages ENABLE ROW LEVEL SECURITY;

-- RLS for customer_prepaid_packages
CREATE POLICY "Admin can manage prepaid packages"
  ON public.customer_prepaid_packages
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role)) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Vendedor can view prepaid packages"
  ON public.customer_prepaid_packages
  FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS for prepaid_package_usages
CREATE POLICY "Admin can manage prepaid usages"
  ON public.prepaid_package_usages
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role)) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Vendedor can insert prepaid usages"
  ON public.prepaid_package_usages
  FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view prepaid usages"
  ON public.prepaid_package_usages
  FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

-- =============================================
-- PART 3: TRIGGER - auto_fulfill_backorders
-- =============================================

-- Function to fulfill backorders FIFO after production
CREATE OR REPLACE FUNCTION public.auto_fulfill_backorders()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  backorder RECORD;
  item RECORD;
  available_stock INTEGER;
  needed_qty INTEGER;
BEGIN
  -- Get current stock of the produced product
  SELECT stock INTO available_stock
  FROM public.products
  WHERE id = NEW.product_id;

  -- Find all backorders that need this product, ordered FIFO
  FOR backorder IN
    SELECT o.id, o.company_id, o.customer_name
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.product_id = NEW.product_id
      AND o.status = 'backorder'
      AND o.company_id = NEW.company_id
    ORDER BY o.created_at ASC
  LOOP
    -- Calculate total units needed for this backorder (of this product)
    SELECT COALESCE(SUM(oi.quantity), 0) INTO needed_qty
    FROM public.order_items oi
    WHERE oi.order_id = backorder.id
      AND oi.product_id = NEW.product_id;

    -- If we have enough stock, fulfill this backorder
    IF available_stock >= needed_qty THEN
      -- Deduct stock (reserve it)
      UPDATE public.products
      SET reserved_stock = reserved_stock + needed_qty
      WHERE id = NEW.product_id;

      -- Activate backorder -> pending
      UPDATE public.orders
      SET status = 'pending', updated_at = now()
      WHERE id = backorder.id;

      -- Record stock movement
      INSERT INTO public.stock_movements (
        product_id, company_id, movement_type, quantity, reference_id, notes
      ) VALUES (
        NEW.product_id,
        backorder.company_id,
        'backorder_fulfilled',
        -needed_qty,
        backorder.id,
        'Pre-pedido activado para ' || backorder.customer_name
      );

      available_stock := available_stock - needed_qty;
    ELSE
      -- No more stock for remaining backorders
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on production_history INSERT
DROP TRIGGER IF EXISTS trigger_fulfill_backorders ON public.production_history;
CREATE TRIGGER trigger_fulfill_backorders
  AFTER INSERT ON public.production_history
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fulfill_backorders();

-- =============================================
-- PART 4: updated_at trigger for prepaid packages
-- =============================================
CREATE TRIGGER update_prepaid_packages_updated_at
  BEFORE UPDATE ON public.customer_prepaid_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
