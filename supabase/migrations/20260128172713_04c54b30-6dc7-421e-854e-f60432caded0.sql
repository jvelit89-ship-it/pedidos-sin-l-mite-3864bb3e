
-- Fix the trigger function with correct PL/pgSQL syntax
CREATE OR REPLACE FUNCTION public.auto_update_stock_on_production()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recipe RECORD;
BEGIN
  -- Aumentar el stock del producto producido
  UPDATE public.products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Si hay recetas para este producto, deducir materiales automáticamente
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
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on production_history for INSERT
DROP TRIGGER IF EXISTS trg_auto_update_stock_on_production_insert ON public.production_history;
CREATE TRIGGER trg_auto_update_stock_on_production_insert
  AFTER INSERT ON public.production_history
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_stock_on_production();

-- Create the trigger for UPDATE as well
DROP TRIGGER IF EXISTS trg_auto_update_stock_on_production_update ON public.production_history;
CREATE TRIGGER trg_auto_update_stock_on_production_update
  AFTER UPDATE ON public.production_history
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_stock_on_production_update();
