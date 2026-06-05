-- 1. Hardening customers table
-- Fill missing document_ids if any with unique values
UPDATE public.customers SET document_id = 'MISSING-' || id::text WHERE document_id IS NULL;
ALTER TABLE public.customers ALTER COLUMN document_id SET NOT NULL;

-- 2. Improving order_items table for performance and better RLS
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Fill company_id from parent orders
UPDATE public.order_items oi
SET company_id = o.company_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.company_id IS NULL;

-- 3. Optimizing RLS for order_items
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Public anonymous order items creation" ON public.order_items;

CREATE POLICY "Users can view order items" ON public.order_items
FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can manage order items" ON public.order_items
FOR ALL USING (company_id = get_user_company_id(auth.uid()))
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- 4. Removing legacy anonymous policies from orders and other tables
DROP POLICY IF EXISTS "Public anonymous order creation" ON public.orders;

-- 5. Adding DNI/RUC format validation trigger
CREATE OR REPLACE FUNCTION public.validate_customer_document() 
RETURNS TRIGGER AS $$
BEGIN
  -- If it starts with MISSING-, it's a legacy record we cleaned up
  IF NEW.document_id LIKE 'MISSING-%' THEN
    RETURN NEW;
  END IF;

  -- Check length/format based on simple rules (DNI=8, RUC=11)
  IF length(NEW.document_id) NOT IN (8, 11) THEN
    RAISE EXCEPTION 'Document ID must be 8 (DNI) or 11 (RUC) digits';
  END IF;
  
  -- Ensure it contains only digits
  IF NEW.document_id !~ '^\d+$' THEN
    RAISE EXCEPTION 'Document ID must contain only numbers';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_validate_customer_document') THEN
    CREATE TRIGGER trigger_validate_customer_document
    BEFORE INSERT OR UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.validate_customer_document();
  END IF;
END $$;

-- 6. Ensure company_id is populated on order_items automatically
CREATE OR REPLACE FUNCTION public.set_order_item_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_set_order_item_company_id') THEN
    CREATE TRIGGER trigger_set_order_item_company_id
    BEFORE INSERT ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.set_order_item_company_id();
  END IF;
END $$;

-- 7. Grant permissions
GRANT ALL ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
