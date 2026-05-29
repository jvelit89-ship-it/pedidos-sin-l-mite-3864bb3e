-- Add created_by column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create a function to set created_by on insert
CREATE OR REPLACE FUNCTION public.set_order_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for created_by
DROP TRIGGER IF EXISTS tr_set_order_created_by ON public.orders;
CREATE TRIGGER tr_set_order_created_by
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_created_by();

-- Create a function to auto-assign vendedor if the creator is a vendedor
CREATE OR REPLACE FUNCTION public.auto_assign_vendedor_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_vendedor_id UUID;
  v_vendedor_name TEXT;
BEGIN
  -- If vendedor_id is already set, don't override
  IF NEW.vendedor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the creator exists in the vendedores table
  SELECT id, name INTO v_vendedor_id, v_vendedor_name
  FROM public.vendedores
  WHERE user_id = auth.uid()
  AND active = true
  LIMIT 1;

  -- If found, assign it
  IF v_vendedor_id IS NOT NULL THEN
    NEW.vendedor_id := v_vendedor_id;
    NEW.vendedor_name := v_vendedor_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assigning vendedor
DROP TRIGGER IF EXISTS tr_auto_assign_vendedor ON public.orders;
CREATE TRIGGER tr_auto_assign_vendedor
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_vendedor_on_order();

-- Note: No GRANTs needed for existing table orders as they should already be present.
-- But ensuring RLS policies are aware of created_by could be useful for future features.
