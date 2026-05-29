-- Add verification columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT,
ADD COLUMN IF NOT EXISTS delivery_pin TEXT,
ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;

-- Note: No new tables, so no new GRANTs needed.
