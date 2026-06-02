ALTER TABLE public.products ADD COLUMN image_url TEXT;

-- Update RLS policies to allow public read of images if stored in a bucket
-- (Assuming we might use a storage bucket later, but for now we just need the column)
