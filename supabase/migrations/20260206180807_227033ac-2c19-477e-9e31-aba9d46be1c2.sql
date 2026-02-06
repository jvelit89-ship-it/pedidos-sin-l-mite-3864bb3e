-- Add missing columns to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'ruc',
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.suppliers.name IS 'Razón Social';
COMMENT ON COLUMN public.suppliers.business_name IS 'Nombre Comercial';
COMMENT ON COLUMN public.suppliers.ruc IS 'RUC o DNI';
COMMENT ON COLUMN public.suppliers.document_type IS 'Tipo de documento: ruc o dni';