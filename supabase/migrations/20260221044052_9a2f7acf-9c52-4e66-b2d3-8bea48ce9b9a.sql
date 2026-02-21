
ALTER TABLE public.customer_prepaid_packages
ADD COLUMN vendedor_id uuid REFERENCES public.vendedores(id);
