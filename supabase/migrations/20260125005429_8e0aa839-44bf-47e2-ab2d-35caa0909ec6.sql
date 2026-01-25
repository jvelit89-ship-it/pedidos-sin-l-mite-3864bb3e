-- Create a trigger function to automatically deduct stock when order items are inserted
-- This runs with SECURITY DEFINER to bypass RLS and ensure stock is always updated
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item()
RETURNS TRIGGER AS $$
DECLARE
  order_company_id UUID;
  order_customer_name TEXT;
BEGIN
  -- Get order details
  SELECT company_id, customer_name INTO order_company_id, order_customer_name
  FROM public.orders
  WHERE id = NEW.order_id;
  
  -- Deduct stock from the product (minimum 0)
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity)
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
    order_company_id,
    'sale',
    -NEW.quantity,
    NEW.order_id,
    'Venta - Pedido para ' || order_customer_name
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on order_items table
DROP TRIGGER IF EXISTS deduct_stock_on_order_item_insert ON public.order_items;
CREATE TRIGGER deduct_stock_on_order_item_insert
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_order_item();