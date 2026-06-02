CREATE OR REPLACE FUNCTION public.merge_duplicate_customers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    duplicate_record RECORD;
    master_id UUID;
    duplicate_ids UUID[];
    merged_count INTEGER := 0;
    total_merged INTEGER := 0;
    result jsonb;
BEGIN
    -- 1. Identificar grupos de duplicados (mismo nombre y teléfono en la misma empresa)
    -- Se ignoran nombres vacíos o teléfonos vacíos
    FOR duplicate_record IN 
        SELECT 
            UPPER(TRIM(name)) as clean_name, 
            UPPER(TRIM(phone)) as clean_phone, 
            company_id,
            ARRAY_AGG(id ORDER BY created_at ASC) as all_ids,
            COUNT(*) as group_count
        FROM customers
        WHERE name IS NOT NULL AND TRIM(name) != ''
          AND phone IS NOT NULL AND TRIM(phone) != ''
        GROUP BY UPPER(TRIM(name)), UPPER(TRIM(phone)), company_id
        HAVING COUNT(*) > 1
    LOOP
        -- El primer ID (más antiguo) será el maestro
        master_id := duplicate_record.all_ids[1];
        -- El resto son duplicados a eliminar
        duplicate_ids := duplicate_record.all_ids[2:array_length(duplicate_record.all_ids, 1)];

        -- 2. Actualizar el registro maestro con datos que podrían faltar (ej. document_id)
        UPDATE customers c_master
        SET 
            document_id = COALESCE(c_master.document_id, (SELECT document_id FROM customers WHERE id = ANY(duplicate_ids) AND document_id IS NOT NULL LIMIT 1)),
            address = COALESCE(c_master.address, (SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1)),
            email = COALESCE(c_master.email, (SELECT email FROM customers WHERE id = ANY(duplicate_ids) AND email IS NOT NULL LIMIT 1)),
            notes = COALESCE(c_master.notes, (SELECT notes FROM customers WHERE id = ANY(duplicate_ids) AND notes IS NOT NULL LIMIT 1))
        WHERE id = master_id;

        -- 3. Reasignar registros en tablas relacionadas
        
        -- Orders
        UPDATE orders SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        
        -- Customer Product Prices
        -- Usamos INSERT ON CONFLICT para evitar duplicados en precios específicos si ya existen para el maestro
        -- Pero como no conocemos el constraint exacto, hacemos un update simple y capturamos errores si es necesario
        -- O mejor, solo actualizamos los que el maestro NO tiene.
        UPDATE customer_product_prices SET customer_id = master_id 
        WHERE customer_id = ANY(duplicate_ids)
        AND product_id NOT IN (SELECT product_id FROM customer_product_prices WHERE customer_id = master_id);
        
        -- Distributor related
        UPDATE distributor_empty_containers SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        UPDATE distributor_credits SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        
        -- Other history/packages
        UPDATE customer_prepaid_packages SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        UPDATE customer_order_history SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);

        -- 4. Eliminar los duplicados sobrantes (después de haber movido las referencias)
        -- Primero eliminamos registros huérfanos en tablas de precios si quedaron algunos por el paso 3
        DELETE FROM customer_product_prices WHERE customer_id = ANY(duplicate_ids);
        
        DELETE FROM customers WHERE id = ANY(duplicate_ids);
        
        total_merged := total_merged + duplicate_record.group_count - 1;
        merged_count := merged_count + 1;
    END LOOP;

    result := jsonb_build_object(
        'groups_processed', merged_count,
        'total_duplicates_removed', total_merged
    );

    RETURN result;
END;
$$;
