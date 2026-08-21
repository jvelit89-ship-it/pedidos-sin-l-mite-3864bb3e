-- Agrega de forma aditiva Termocontraíble 20L (caño y tapa) como materia prima
-- de los productos finales Agua Santa María 20L en bidón.
--
-- La lógica de consumo NO se hardcodea por producto: production_history activa
-- auto_update_stock_on_production(), que recorre todas las recetas activas del
-- producto y descuenta cantidad_producida * quantity_ratio para cada material.
--
-- Si el material todavía no existe en una empresa, se crea con stock 0 para que
-- el inventario inicial sea cargado explícitamente antes de producir.

DO $$
DECLARE
  output_product RECORD;
  shrink_product_id UUID;
BEGIN
  FOR output_product IN
    SELECT id, company_id
    FROM public.products
    WHERE
      (product_type = 'final' OR product_type IS NULL)
      AND name ILIKE '%20L%'
      AND (name ILIKE '%Agua Santa Maria%' OR name ILIKE '%Agua Santa María%')
      AND (name ILIKE '%Bidon%' OR name ILIKE '%Bidón%')
  LOOP
    shrink_product_id := NULL;

    SELECT id
      INTO shrink_product_id
    FROM public.products
    WHERE company_id = output_product.company_id
      AND (
        lower(trim(name)) IN (
          lower('Termocontraíble 20L (caño y tapa)'),
          lower('Termocontraible 20L (caño y tapa)'),
          lower('Termocontraíble 20L'),
          lower('Termocontraible 20L')
        )
        OR sku = 'MP-TERMO20L'
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
        'Termocontraíble 20L (caño y tapa)',
        'MP-TERMO20L',
        'Materia Prima',
        0,
        0,
        0,
        0,
        'Materia prima para bidones Agua Santa María 20L. Consumo inicial configurado: 1 unidad por bidón producido.',
        'raw_material'
      )
      RETURNING id INTO shrink_product_id;
    END IF;

    -- Solo crea la relación cuando todavía no existe. Si ya fue configurada
    -- manualmente, conserva su ratio y estado actuales.
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
