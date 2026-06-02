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
        master_id := duplicate_record.all_ids[1];
        duplicate_ids := duplicate_record.all_ids[2:array_length(duplicate_record.all_ids, 1)];

        -- 2. Consolidar datos en el maestro
        UPDATE customers c_master
        SET 
            document_id = COALESCE(c_master.document_id, (SELECT document_id FROM customers WHERE id = ANY(duplicate_ids) AND document_id IS NOT NULL LIMIT 1)),
            address = COALESCE(c_master.address, (SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1)),
            email = COALESCE(c_master.email, (SELECT email FROM customers WHERE id = ANY(duplicate_ids) AND email IS NOT NULL LIMIT 1)),
            notes = COALESCE(c_master.notes, (SELECT notes FROM customers WHERE id = ANY(duplicate_ids) AND notes IS NOT NULL LIMIT 1)),
            updated_at = NOW()
        WHERE id = master_id;

        -- 3. Reasignar registros en tablas base
        UPDATE orders SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        
        -- Customer Product Prices (solo actualizar si el maestro no tiene ese producto)
        UPDATE customer_product_prices SET customer_id = master_id 
        WHERE customer_id = ANY(duplicate_ids)
        AND product_id NOT IN (SELECT product_id FROM customer_product_prices WHERE customer_id = master_id);
        
        UPDATE distributor_empty_containers SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        UPDATE distributor_credits SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);
        UPDATE customer_prepaid_packages SET customer_id = master_id WHERE customer_id = ANY(duplicate_ids);

        -- 4. Limpiar precios duplicados que no se pudieron mover
        DELETE FROM customer_product_prices WHERE customer_id = ANY(duplicate_ids);
        
        -- 5. Eliminar clientes duplicados
        DELETE FROM customers WHERE id = ANY(duplicate_ids);
        
        total_merged := total_merged + duplicate_record.group_count - 1;
        merged_count := merged_count + 1;
    END LOOP;

    result := jsonb_build_object(
        'groups_processed', merged_count,
        'total_duplicates_removed', total_merged,
        'status', 'success'
    );

    RETURN result;
END;
$$;
