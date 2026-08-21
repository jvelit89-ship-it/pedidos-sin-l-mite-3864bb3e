-- Refuerza el consumo automático de materias primas para TODA producción con receta.
-- Mantiene el mismo flujo existente: insertar en production_history aumenta el
-- producto final y descuenta cada material activo según:
--   cantidad consumida = NEW.quantity * production_recipes.quantity_ratio
--
-- La mejora principal es bloquear las filas de materia prima durante la
-- validación para evitar sobreconsumo si se registran producciones simultáneas.

CREATE OR REPLACE FUNCTION public.auto_update_stock_on_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipe RECORD;
  required_qty numeric;
BEGIN
  -- Bloquear y validar TODAS las materias primas activas de la receta.
  -- El orden determinista reduce el riesgo de deadlocks cuando hay varias recetas.
  FOR recipe IN
    SELECT
      pr.input_product_id,
      pr.quantity_ratio,
      p.name,
      p.stock
    FROM public.production_recipes pr
    JOIN public.products p
      ON p.id = pr.input_product_id
     AND p.company_id = NEW.company_id
    WHERE pr.output_product_id = NEW.product_id
      AND pr.is_active = true
      AND pr.company_id = NEW.company_id
    ORDER BY pr.input_product_id
    FOR UPDATE OF p
  LOOP
    required_qty := NEW.quantity * recipe.quantity_ratio;

    IF recipe.stock < required_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente de materia prima "%": se requieren % y solo hay %',
        recipe.name,
        required_qty,
        recipe.stock
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Aumentar el stock del producto final producido.
  UPDATE public.products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id
    AND company_id = NEW.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto final no encontrado para la empresa actual'
      USING ERRCODE = 'P0001';
  END IF;

  -- Descontar TODAS las materias primas asociadas a la receta activa.
  FOR recipe IN
    SELECT input_product_id, quantity_ratio
    FROM public.production_recipes
    WHERE output_product_id = NEW.product_id
      AND is_active = true
      AND company_id = NEW.company_id
    ORDER BY input_product_id
  LOOP
    required_qty := NEW.quantity * recipe.quantity_ratio;

    UPDATE public.products
    SET stock = stock - required_qty
    WHERE id = recipe.input_product_id
      AND company_id = NEW.company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Materia prima de receta no encontrada para la empresa actual'
        USING ERRCODE = 'P0001';
    END IF;

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
      -required_qty,
      NEW.id,
      'Material consumido automáticamente por receta de producción'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
