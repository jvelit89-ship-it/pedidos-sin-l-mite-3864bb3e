-- Add bank fields to suppliers
ALTER TABLE public.suppliers
ADD COLUMN bank_name text NULL,
ADD COLUMN account_number text NULL,
ADD COLUMN cci text NULL;