-- Eliminar triggers duplicados
DROP TRIGGER IF EXISTS deduct_stock_on_order_item_insert ON public.order_items;
DROP TRIGGER IF EXISTS auto_update_stock_on_production_insert ON public.production_history;
DROP TRIGGER IF EXISTS auto_update_stock_on_production_update ON public.production_history;
DROP TRIGGER IF EXISTS auto_deduct_stock_on_waste_insert ON public.production_waste;

-- Mantener únicamente los triggers con prefijo trg_
-- (ya existen: trg_deduct_stock_on_order_item, trg_auto_update_stock_on_production_insert, 
--  trg_auto_update_stock_on_production_update, trg_auto_deduct_stock_on_waste_insert)