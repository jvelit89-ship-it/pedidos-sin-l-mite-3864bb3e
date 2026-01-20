-- Create customer-specific pricing table
CREATE TABLE public.customer_product_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price NUMERIC(12, 4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Enable RLS
ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view customer prices for their company"
  ON public.customer_product_prices
  FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert customer prices"
  ON public.customer_product_prices
  FOR INSERT
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid()) AND
    public.get_user_role(auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "Admins can update customer prices"
  ON public.customer_product_prices
  FOR UPDATE
  USING (
    company_id = public.get_user_company_id(auth.uid()) AND
    public.get_user_role(auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "Admins can delete customer prices"
  ON public.customer_product_prices
  FOR DELETE
  USING (
    company_id = public.get_user_company_id(auth.uid()) AND
    public.get_user_role(auth.uid()) IN ('admin', 'superadmin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_customer_product_prices_updated_at
  BEFORE UPDATE ON public.customer_product_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_product_prices;