
-- Create truck_extra_loads table
CREATE TABLE public.truck_extra_loads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repartidor_id UUID NOT NULL REFERENCES public.repartidores(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create truck_extra_load_items table
CREATE TABLE public.truck_extra_load_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.truck_extra_loads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quantity_loaded INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.truck_extra_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_extra_load_items ENABLE ROW LEVEL SECURITY;

-- RLS for truck_extra_loads
CREATE POLICY "Admin can manage truck extra loads"
  ON public.truck_extra_loads FOR ALL
  USING (
    (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Repartidor can view own truck extra loads"
  ON public.truck_extra_loads FOR SELECT
  USING (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND repartidor_id IN (
      SELECT id FROM public.repartidores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Repartidor can create own truck extra loads"
  ON public.truck_extra_loads FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND repartidor_id IN (
      SELECT id FROM public.repartidores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Repartidor can update own truck extra loads"
  ON public.truck_extra_loads FOR UPDATE
  USING (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND repartidor_id IN (
      SELECT id FROM public.repartidores WHERE user_id = auth.uid()
    )
  );

-- RLS for truck_extra_load_items
CREATE POLICY "Admin can manage truck extra load items"
  ON public.truck_extra_load_items FOR ALL
  USING (
    (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Repartidor can view own truck extra load items"
  ON public.truck_extra_load_items FOR SELECT
  USING (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND load_id IN (
      SELECT id FROM public.truck_extra_loads
      WHERE repartidor_id IN (SELECT id FROM public.repartidores WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Repartidor can insert truck extra load items"
  ON public.truck_extra_load_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND load_id IN (
      SELECT id FROM public.truck_extra_loads
      WHERE repartidor_id IN (SELECT id FROM public.repartidores WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Repartidor can update truck extra load items"
  ON public.truck_extra_load_items FOR UPDATE
  USING (
    has_role(auth.uid(), 'repartidor'::user_role)
    AND company_id = get_user_company_id(auth.uid())
    AND load_id IN (
      SELECT id FROM public.truck_extra_loads
      WHERE repartidor_id IN (SELECT id FROM public.repartidores WHERE user_id = auth.uid())
    )
  );

-- Trigger: deduct stock when items are added to truck load
CREATE OR REPLACE FUNCTION public.deduct_stock_on_truck_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deduct from warehouse stock
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity_loaded)
  WHERE id = NEW.product_id;

  -- Record stock movement
  INSERT INTO public.stock_movements (
    product_id, company_id, movement_type, quantity, reference_id, notes
  ) VALUES (
    NEW.product_id,
    NEW.company_id,
    'truck_load',
    -NEW.quantity_loaded,
    NEW.load_id,
    'Carga extra al camión'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_deduct_stock_on_truck_load
  AFTER INSERT ON public.truck_extra_load_items
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_on_truck_load();

-- Function to close a truck extra load and return unsold stock
CREATE OR REPLACE FUNCTION public.close_truck_extra_load(_load_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  load_company_id UUID;
  return_qty INTEGER;
BEGIN
  -- Verify load exists and is active
  SELECT company_id INTO load_company_id
  FROM public.truck_extra_loads
  WHERE id = _load_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carga no encontrada o ya cerrada';
  END IF;

  -- Process each item
  FOR item IN
    SELECT * FROM public.truck_extra_load_items WHERE load_id = _load_id
  LOOP
    return_qty := item.quantity_loaded - item.quantity_sold;

    IF return_qty > 0 THEN
      -- Return to warehouse stock
      UPDATE public.products
      SET stock = stock + return_qty
      WHERE id = item.product_id;

      -- Record return movement
      INSERT INTO public.stock_movements (
        product_id, company_id, movement_type, quantity, reference_id, notes
      ) VALUES (
        item.product_id,
        load_company_id,
        'truck_return',
        return_qty,
        _load_id,
        'Devolución de carga extra del camión'
      );

      -- Update item record
      UPDATE public.truck_extra_load_items
      SET quantity_returned = return_qty
      WHERE id = item.id;
    END IF;
  END LOOP;

  -- Mark load as closed
  UPDATE public.truck_extra_loads
  SET status = 'closed', closed_at = now()
  WHERE id = _load_id;
END;
$$;
