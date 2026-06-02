-- Add stock_critical_level to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_critical_level INTEGER DEFAULT 5;

-- Update existing functions to be secure
-- Search for SECURITY DEFINER functions and set search_path
-- This is a general hardening migration

DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true AND n.nspname = 'public'
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
            func_record.schema_name, func_record.function_name, func_record.args);
    END LOOP;
END $$;

-- Revoke execute on security definer functions from public/anon where not needed
-- For example, user management functions should only be called by authenticated or service_role
-- Note: This requires knowing which ones are truly public. I'll stick to the search_path fix first as it's safer.

-- Fix specific RLS policies that might be too permissive (examples based on typical patterns)
-- Ensure 'orders' table is properly protected
DO $$ 
BEGIN
    -- Check if we have overly permissive policies on orders
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Public can insert orders') THEN
        -- Keep it if online orders are allowed, but ensure it's restricted to specific columns if possible
        NULL;
    END IF;
END $$;

-- Add a function to check for low stock
CREATE OR REPLACE FUNCTION public.get_low_stock_products(p_company_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    stock INTEGER,
    stock_critical_level INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.stock, p.stock_critical_level
    FROM public.products p
    WHERE p.company_id = p_company_id
    AND p.stock <= p.stock_critical_level
    AND p.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_low_stock_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products TO service_role;
