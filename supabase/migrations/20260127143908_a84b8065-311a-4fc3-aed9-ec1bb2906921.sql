-- Re-attach stock management triggers (they were missing)

-- 1) Deduct stock on order item insert
DROP TRIGGER IF EXISTS trg_deduct_stock_on_order_item ON public.order_items;
CREATE TRIGGER trg_deduct_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_order_item();

-- 2) Update stock on production insert
DROP TRIGGER IF EXISTS trg_auto_update_stock_on_production_insert ON public.production_history;
CREATE TRIGGER trg_auto_update_stock_on_production_insert
AFTER INSERT ON public.production_history
FOR EACH ROW
EXECUTE FUNCTION public.auto_update_stock_on_production();

-- 3) Update stock on production quantity update
DROP TRIGGER IF EXISTS trg_auto_update_stock_on_production_update ON public.production_history;
CREATE TRIGGER trg_auto_update_stock_on_production_update
AFTER UPDATE OF quantity ON public.production_history
FOR EACH ROW
WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
EXECUTE FUNCTION public.auto_update_stock_on_production_update();

-- 4) Deduct stock on waste insert
DROP TRIGGER IF EXISTS trg_auto_deduct_stock_on_waste_insert ON public.production_waste;
CREATE TRIGGER trg_auto_deduct_stock_on_waste_insert
AFTER INSERT ON public.production_waste
FOR EACH ROW
EXECUTE FUNCTION public.auto_deduct_stock_on_waste();

-- Recalculation helpers (admin-only)
CREATE OR REPLACE FUNCTION public.recalculate_company_stock(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH stock_calc AS (
    SELECT
      p.id AS product_id,
      GREATEST(
        0,
        COALESCE(ph.total_produced, 0)
        - COALESCE(sales.total_sold, 0)
        - COALESCE(waste.total_waste, 0)
        - COALESCE(cons.total_consumed, 0)
        + COALESCE(adj.total_manual_adjustment, 0)
      )::integer AS new_stock
    FROM public.products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity)::numeric AS total_produced
      FROM public.production_history
      WHERE company_id = _company_id
      GROUP BY product_id
    ) ph ON ph.product_id = p.id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity)::numeric AS total_sold
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.company_id = _company_id
        AND o.status <> 'cancelled'
      GROUP BY oi.product_id
    ) sales ON sales.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity)::numeric AS total_waste
      FROM public.production_waste
      WHERE company_id = _company_id
      GROUP BY product_id
    ) waste ON waste.product_id = p.id
    LEFT JOIN (
      SELECT pr.input_product_id AS product_id,
             SUM(ph.quantity * pr.quantity_ratio)::numeric AS total_consumed
      FROM public.production_history ph
      JOIN public.production_recipes pr
        ON pr.output_product_id = ph.product_id
       AND pr.company_id = ph.company_id
       AND pr.is_active = true
      WHERE ph.company_id = _company_id
      GROUP BY pr.input_product_id
    ) cons ON cons.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity)::numeric AS total_manual_adjustment
      FROM public.stock_movements
      WHERE company_id = _company_id
        AND movement_type = 'adjustment'
        AND reference_id IS NULL
        AND (notes IS NULL OR notes NOT ILIKE 'Merma:%')
      GROUP BY product_id
    ) adj ON adj.product_id = p.id
    WHERE p.company_id = _company_id
  )
  UPDATE public.products p
  SET stock = sc.new_stock
  FROM stock_calc sc
  WHERE p.id = sc.product_id
    AND p.company_id = _company_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_my_company_stock()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.user_role) OR public.has_role(auth.uid(), 'superadmin'::public.user_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  cid := public.get_user_company_id(auth.uid());
  RETURN public.recalculate_company_stock(cid);
END;
$$;