-- ============================================================================
-- SOLUCIÓN DEFINITIVA: Stock automático con triggers de base de datos
-- Esto garantiza que el stock SIEMPRE se actualice sin importar el rol del usuario
-- ============================================================================

-- 1. TRIGGER: Actualizar stock automáticamente cuando se registra producción
CREATE OR REPLACE FUNCTION public.auto_update_stock_on_production()
RETURNS TRIGGER AS $$
BEGIN
  -- Aumentar el stock del producto producido
  UPDATE public.products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Si hay recetas para este producto, deducir materiales automáticamente
  -- Esto maneja la producción con recetas
  DECLARE
    recipe RECORD;
  BEGIN
    FOR recipe IN 
      SELECT input_product_id, quantity_ratio
      FROM public.production_recipes
      WHERE output_product_id = NEW.product_id 
        AND is_active = true
        AND company_id = NEW.company_id
    LOOP
      -- Deducir material de entrada
      UPDATE public.products
      SET stock = GREATEST(0, stock - (NEW.quantity * recipe.quantity_ratio))
      WHERE id = recipe.input_product_id;
      
      -- Registrar movimiento de material consumido
      INSERT INTO public.stock_movements (
        product_id,
        company_id,
        movement_type,
        quantity,
        reference_id,
        notes
      ) VALUES (
        recipe.input_product_id,
        NEW.company_id,
        'adjustment',
        -(NEW.quantity * recipe.quantity_ratio),
        NEW.id,
        'Material consumido en producción'
      );
    END LOOP;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear el trigger
DROP TRIGGER IF EXISTS auto_update_stock_on_production_insert ON public.production_history;
CREATE TRIGGER auto_update_stock_on_production_insert
AFTER INSERT ON public.production_history
FOR EACH ROW
EXECUTE FUNCTION public.auto_update_stock_on_production();

-- 2. TRIGGER: Manejar actualizaciones de producción (cuando se edita cantidad)
CREATE OR REPLACE FUNCTION public.auto_update_stock_on_production_update()
RETURNS TRIGGER AS $$
DECLARE
  quantity_diff INTEGER;
  recipe RECORD;
BEGIN
  -- Calcular diferencia de cantidad
  quantity_diff := NEW.quantity - OLD.quantity;
  
  IF quantity_diff != 0 THEN
    -- Ajustar stock del producto producido
    UPDATE public.products
    SET stock = stock + quantity_diff
    WHERE id = NEW.product_id;
    
    -- Ajustar materiales de entrada si hay recetas
    FOR recipe IN 
      SELECT input_product_id, quantity_ratio
      FROM public.production_recipes
      WHERE output_product_id = NEW.product_id 
        AND is_active = true
        AND company_id = NEW.company_id
    LOOP
      UPDATE public.products
      SET stock = GREATEST(0, stock - (quantity_diff * recipe.quantity_ratio))
      WHERE id = recipe.input_product_id;
      
      -- Registrar movimiento de ajuste
      INSERT INTO public.stock_movements (
        product_id,
        company_id,
        movement_type,
        quantity,
        reference_id,
        notes
      ) VALUES (
        recipe.input_product_id,
        NEW.company_id,
        'adjustment',
        -(quantity_diff * recipe.quantity_ratio),
        NEW.id,
        'Ajuste de material por edición de producción'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear el trigger de actualización
DROP TRIGGER IF EXISTS auto_update_stock_on_production_update ON public.production_history;
CREATE TRIGGER auto_update_stock_on_production_update
AFTER UPDATE ON public.production_history
FOR EACH ROW
WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
EXECUTE FUNCTION public.auto_update_stock_on_production_update();

-- 3. TRIGGER: Manejar merma (production_waste) automáticamente
CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_waste()
RETURNS TRIGGER AS $$
BEGIN
  -- Deducir del stock
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity)
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear el trigger de merma
DROP TRIGGER IF EXISTS auto_deduct_stock_on_waste_insert ON public.production_waste;
CREATE TRIGGER auto_deduct_stock_on_waste_insert
AFTER INSERT ON public.production_waste
FOR EACH ROW
EXECUTE FUNCTION public.auto_deduct_stock_on_waste();