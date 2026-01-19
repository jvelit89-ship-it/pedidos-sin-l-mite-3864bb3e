-- Create enum for customer type
CREATE TYPE public.customer_type AS ENUM ('minorista', 'mayorista');

-- Add customer_type column to customers table
ALTER TABLE public.customers ADD COLUMN customer_type public.customer_type DEFAULT 'minorista';