
CREATE OR REPLACE FUNCTION public.auto_update_stock_on_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipe RECORD;
  required_qty numeric;
  current_stock numeric;
  input_name text;
BEGIN
  -- Verificar stock suficiente de TODA la materia prima ANTES de producir
  FOR recipe IN
    SELECT pr.input_product_id, pr.quantity_ratio, p.name, p.stock
    FROM public.production_recipes pr
    JOIN public.products p ON p.id = pr.input_product_id
    WHERE pr.output_product_id = NEW.product_id
      AND pr.is_active = true
      AND pr.company_id = NEW.company_id
  LOOP
    required_qty := NEW.quantity * recipe.quantity_ratio;
    IF recipe.stock < required_qty THEN
      RAISE EXCEPTION 'Stock insuficiente de materia prima "%": se requieren % y solo hay %', recipe.name, required_qty, recipe.stock
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Aumentar el stock del producto producido
  UPDATE public.products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;

  -- Deducir materias primas según receta
  FOR recipe IN
    SELECT input_product_id, quantity_ratio
    FROM public.production_recipes
    WHERE output_product_id = NEW.product_id
      AND is_active = true
      AND company_id = NEW.company_id
  LOOP
    UPDATE public.products
    SET stock = GREATEST(0, stock - (NEW.quantity * recipe.quantity_ratio))
    WHERE id = recipe.input_product_id;

    INSERT INTO public.stock_movements (
      product_id, company_id, movement_type, quantity, reference_id, notes
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
