-- No podemos poner NOT NULL de inmediato si hay datos existentes sin document_id
-- Primero actualizamos registros vacíos si los hay (opcional, o fallará la restricción)
-- UPDATE public.customers SET document_id = 'POR-DEFINIR' WHERE document_id IS NULL;

-- Hacer document_id obligatorio en la tabla de clientes
-- ALTER TABLE public.customers ALTER COLUMN document_id SET NOT NULL;

-- Añadir una restricción de validación para longitud (DNI=8, RUC=11)
ALTER TABLE public.customers ADD CONSTRAINT document_id_length_check 
CHECK (document_id IS NULL OR length(document_id) >= 8);

-- En la tabla de pedidos, document_id suele ir en la columna document_number si existe
-- O se guarda en 'notes' según el código actual. Vamos a asegurar que la tabla 'orders' 
-- pueda almacenar estos datos de forma estructurada si no lo hace ya.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'document_number') THEN
        ALTER TABLE public.orders ADD COLUMN document_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'document_type') THEN
        ALTER TABLE public.orders ADD COLUMN document_type TEXT CHECK (document_type IN ('dni', 'ruc'));
    END IF;
END $$;
