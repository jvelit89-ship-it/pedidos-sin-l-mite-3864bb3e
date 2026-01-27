-- =====================================================
-- NUEVA LÓGICA DE STOCK: Descontar solo al entregar
-- =====================================================

-- 1. Eliminar el trigger actual que descuenta al crear order_items
DROP TRIGGER IF EXISTS trg_deduct_stock_on_order_item ON public.order_items;

-- 2. Agregar columna reserved_stock a products para tracking de stock en tránsito
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0;

-- Añadir comentario descriptivo
COMMENT ON COLUMN public.products.reserved_stock IS 'Stock reservado/en tránsito (cargado en vehículos pero no entregado)';

-- 3. Crear función para reservar stock cuando se crea un pedido
CREATE OR REPLACE FUNCTION public.reserve_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Aumentar stock reservado
  UPDATE public.products
  SET reserved_stock = reserved_stock + NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$;

-- 4. Crear función para descontar stock SOLO cuando el pedido se marca como entregado
CREATE OR REPLACE FUNCTION public.deduct_stock_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  order_company_id UUID;
BEGIN
  -- Solo actuar cuando el status cambia A 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    order_company_id := NEW.company_id;
    
    -- Para cada item del pedido
    FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
    LOOP
      -- Descontar del stock real
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity),
          reserved_stock = GREATEST(0, reserved_stock - item.quantity)
      WHERE id = item.product_id;
      
      -- Registrar movimiento de stock
      INSERT INTO public.stock_movements (
        product_id,
        company_id,
        movement_type,
        quantity,
        reference_id,
        notes
      ) VALUES (
        item.product_id,
        order_company_id,
        'sale',
        -item.quantity,
        NEW.id,
        'Venta entregada - Pedido para ' || NEW.customer_name
      );
    END LOOP;
  END IF;
  
  -- Si el pedido se cancela ANTES de ser entregado, liberar reserva
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND OLD.status != 'delivered' THEN
    FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
    LOOP
      -- Liberar stock reservado
      UPDATE public.products
      SET reserved_stock = GREATEST(0, reserved_stock - item.quantity)
      WHERE id = item.product_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Crear función para liberar reserva si se elimina un order_item (antes de entrega)
CREATE OR REPLACE FUNCTION public.release_reserved_stock_on_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_status TEXT;
BEGIN
  -- Obtener el estado actual del pedido
  SELECT status INTO order_status FROM public.orders WHERE id = OLD.order_id;
  
  -- Solo liberar reserva si el pedido NO está entregado
  IF order_status IS NULL OR order_status != 'delivered' THEN
    UPDATE public.products
    SET reserved_stock = GREATEST(0, reserved_stock - OLD.quantity)
    WHERE id = OLD.product_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- 6. Función para manejar cambios de cantidad en items (edición de pedido)
CREATE OR REPLACE FUNCTION public.adjust_reserved_stock_on_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_status TEXT;
  qty_diff INTEGER;
BEGIN
  -- Obtener el estado actual del pedido
  SELECT status INTO order_status FROM public.orders WHERE id = NEW.order_id;
  
  -- Solo ajustar reserva si el pedido NO está entregado
  IF order_status IS NULL OR order_status != 'delivered' THEN
    qty_diff := NEW.quantity - OLD.quantity;
    
    IF qty_diff != 0 THEN
      UPDATE public.products
      SET reserved_stock = GREATEST(0, reserved_stock + qty_diff)
      WHERE id = NEW.product_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Crear los nuevos triggers
CREATE TRIGGER trg_reserve_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.reserve_stock_on_order_item();

CREATE TRIGGER trg_deduct_stock_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_delivery();

CREATE TRIGGER trg_release_reserved_stock_on_item_delete
BEFORE DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.release_reserved_stock_on_item_delete();

CREATE TRIGGER trg_adjust_reserved_stock_on_item_update
AFTER UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.adjust_reserved_stock_on_item_update();

-- 8. Calcular reserved_stock inicial basado en pedidos activos no entregados
UPDATE public.products p
SET reserved_stock = COALESCE((
  SELECT SUM(oi.quantity)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id = p.id
    AND o.status NOT IN ('delivered', 'cancelled')
), 0);

-- 9. Actualizar función de recálculo para considerar la nueva lógica
CREATE OR REPLACE FUNCTION public.recalculate_company_stock(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH stock_calc AS (
    SELECT
      p.id AS product_id,
      -- Stock real = producción - ventas ENTREGADAS - merma - consumo recetas + ajustes
      GREATEST(
        0,
        COALESCE(ph.total_produced, 0)
        - COALESCE(sales.total_sold, 0)
        - COALESCE(waste.total_waste, 0)
        - COALESCE(cons.total_consumed, 0)
        + COALESCE(adj.total_manual_adjustment, 0)
      )::integer AS new_stock,
      -- Stock reservado = items de pedidos NO entregados/cancelados
      COALESCE(reserved.total_reserved, 0)::integer AS new_reserved
    FROM public.products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity)::numeric AS total_produced
      FROM public.production_history
      WHERE company_id = _company_id
      GROUP BY product_id
    ) ph ON ph.product_id = p.id
    LEFT JOIN (
      -- Solo ventas ENTREGADAS
      SELECT oi.product_id, SUM(oi.quantity)::numeric AS total_sold
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.company_id = _company_id
        AND o.status = 'delivered'
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
             SUM(ph2.quantity * pr.quantity_ratio)::numeric AS total_consumed
      FROM public.production_history ph2
      JOIN public.production_recipes pr
        ON pr.output_product_id = ph2.product_id
       AND pr.company_id = ph2.company_id
       AND pr.is_active = true
      WHERE ph2.company_id = _company_id
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
    LEFT JOIN (
      -- Stock reservado (pedidos activos no entregados)
      SELECT oi.product_id, SUM(oi.quantity)::numeric AS total_reserved
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.company_id = _company_id
        AND o.status NOT IN ('delivered', 'cancelled')
      GROUP BY oi.product_id
    ) reserved ON reserved.product_id = p.id
    WHERE p.company_id = _company_id
  )
  UPDATE public.products p
  SET stock = sc.new_stock,
      reserved_stock = sc.new_reserved
  FROM stock_calc sc
  WHERE p.id = sc.product_id
    AND p.company_id = _company_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;