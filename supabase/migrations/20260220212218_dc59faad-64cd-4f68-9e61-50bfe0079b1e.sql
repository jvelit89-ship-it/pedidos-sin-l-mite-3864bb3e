-- Add product_type column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'final'
CHECK (product_type IN ('final', 'raw_material'));