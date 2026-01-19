-- Add optional business_name column to customers table
ALTER TABLE public.customers ADD COLUMN business_name text;