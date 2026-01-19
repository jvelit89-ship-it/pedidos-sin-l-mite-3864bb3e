-- Add operario commission amount to products table
ALTER TABLE public.products 
ADD COLUMN operario_commission_amount numeric DEFAULT 0 NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.operario_commission_amount IS 'Commission amount per unit for operarios based on production';