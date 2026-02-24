
ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_movement_type_check;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
CHECK (movement_type = ANY (ARRAY['production'::text, 'sale'::text, 'adjustment'::text, 'purchase'::text, 'purchase_cancelled'::text, 'truck_load'::text, 'truck_return'::text, 'backorder_fulfilled'::text]));
