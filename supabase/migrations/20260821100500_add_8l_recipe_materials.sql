-- Agrega de forma aditiva dos materias primas a la receta de Agua Santa Maria 8L.
-- No modifica la receta existente de Botellas PET 8L ni toca stock previo.
-- Si las materias primas todavía no existen, se crean con stock 0 para que el
-- inventario inicial sea cargado explícitamente antes de producir.

DO $$
DECLARE
  output_product RECORD;
  label_product_id UUID;
  shrink_product_id UUID;
BEGIN
  FOR output_product IN
    SELECT id, company_id
    FROM public.products
    WHERE
      (sku = 'P001' AND name ILIKE '%8L%')
      OR name ILIKE 'Agua Santa Maria 8L'
      OR name ILIKE 'Agua Santa María 8L'
  LOOP
    label_product_id := NULL;
    shrink_product_id := NULL;

    SELECT id
      INTO label_product_id
    FROM public.products
    WHERE company_id = output_product.company_id
      AND (
        lower(trim(name)) = lower('Etiquetas 8L')
        OR sku = 'MP-ETI8L'
      )
    ORDER BY created_at
    LIMIT 1;

    IF label_product_id IS NULL THEN
      INSERT INTO public.products (
        company_id,
        name,
        sku,
        category,
        stock,
        min_stock,
        stock_critical_level,
        price,
        notes,
        product_type
      ) VALUES (
        output_product.company_id,
        'Etiquetas 8L',
        'MP-ETI8L',
        'Materia Prima',
        0,
        0,
        0,
        0,
        'Materia prima para Agua Santa Maria 8L. Consumo: 1 etiqueta por unidad producida.',
        'raw_material'
      )
      RETURNING id INTO label_product_id;
    END IF;

    SELECT id
      INTO shrink_product_id
    FROM public.products
    WHERE company_id = output_product.company_id
      AND (
        lower(trim(name)) IN (lower('Termocontraíble 8L'), lower('Termocontraible 8L'))
        OR sku = 'MP-TERMO8L'
      )
    ORDER BY created_at
    LIMIT 1;

    IF shrink_product_id IS NULL THEN
      INSERT INTO public.products (
        company_id,
        name,
        sku,
        category,
        stock,
        min_stock,
        stock_critical_level,
        price,
        notes,
        product_type
      ) VALUES (
        output_product.company_id,
        'Termocontraíble 8L',
        'MP-TERMO8L',
        'Materia Prima',
        0,
        0,
        0,
        0,
        'Materia prima para Agua Santa Maria 8L. Consumo: 1 termocontraíble por unidad producida.',
        'raw_material'
      )
      RETURNING id INTO shrink_product_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.production_recipes
      WHERE company_id = output_product.company_id
        AND output_product_id = output_product.id
        AND input_product_id = label_product_id
    ) THEN
      INSERT INTO public.production_recipes (
        company_id,
        output_product_id,
        input_product_id,
        quantity_ratio,
        is_active
      ) VALUES (
        output_product.company_id,
        output_product.id,
        label_product_id,
        1,
        true
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.production_recipes
      WHERE company_id = output_product.company_id
        AND output_product_id = output_product.id
        AND input_product_id = shrink_product_id
    ) THEN
      INSERT INTO public.production_recipes (
        company_id,
        output_product_id,
        input_product_id,
        quantity_ratio,
        is_active
      ) VALUES (
        output_product.company_id,
        output_product.id,
        shrink_product_id,
        1,
        true
      );
    END IF;
  END LOOP;
END $$;
