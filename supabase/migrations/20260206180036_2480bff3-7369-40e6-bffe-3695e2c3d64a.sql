-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ruc TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  receipt_type TEXT NOT NULL DEFAULT 'factura', -- factura, boleta
  receipt_series TEXT,
  receipt_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency TEXT NOT NULL DEFAULT 'PEN',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_items table
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  stock_updated BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
CREATE POLICY "Admins can manage suppliers"
ON public.suppliers FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can view suppliers"
ON public.suppliers FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Purchases policies
CREATE POLICY "Admins can manage purchases"
ON public.purchases FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Users can view purchases"
ON public.purchases FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Purchase items policies
CREATE POLICY "Users can manage purchase items"
ON public.purchase_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
    AND p.company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  )
);

CREATE POLICY "Users can view purchase items"
ON public.purchase_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_items.purchase_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Trigger to update stock on purchase item insert
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  purchase_company_id UUID;
  purchase_status TEXT;
BEGIN
  -- Get purchase info
  SELECT company_id, status INTO purchase_company_id, purchase_status
  FROM public.purchases
  WHERE id = NEW.purchase_id;
  
  -- Only update stock if purchase is active
  IF purchase_status = 'active' AND NOT NEW.stock_updated THEN
    -- Increase product stock
    UPDATE public.products
    SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id;
    
    -- Record stock movement
    INSERT INTO public.stock_movements (
      product_id,
      company_id,
      movement_type,
      quantity,
      reference_id,
      notes
    ) VALUES (
      NEW.product_id,
      purchase_company_id,
      'purchase',
      NEW.quantity,
      NEW.purchase_id,
      'Compra - Ingreso de mercadería'
    );
    
    -- Mark as updated
    NEW.stock_updated := true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_purchase
BEFORE INSERT ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_on_purchase_item();

-- Function to revert stock on purchase cancellation
CREATE OR REPLACE FUNCTION public.revert_stock_on_purchase_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only act when status changes to cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
    -- For each item in the purchase
    FOR item IN SELECT * FROM public.purchase_items WHERE purchase_id = NEW.id AND stock_updated = true
    LOOP
      -- Decrease product stock
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity)
      WHERE id = item.product_id;
      
      -- Record stock movement reversal
      INSERT INTO public.stock_movements (
        product_id,
        company_id,
        movement_type,
        quantity,
        reference_id,
        notes
      ) VALUES (
        item.product_id,
        NEW.company_id,
        'purchase_cancelled',
        -item.quantity,
        NEW.id,
        'Anulación de compra - Reversión de stock'
      );
    END LOOP;
    
    -- Mark items as not updated
    UPDATE public.purchase_items
    SET stock_updated = false
    WHERE purchase_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_revert_stock_on_cancel
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.revert_stock_on_purchase_cancel();

-- Updated_at triggers
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();