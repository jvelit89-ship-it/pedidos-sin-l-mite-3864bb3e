-- Create volume pricing rules table
CREATE TABLE public.volume_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, min_quantity)
);

-- Enable RLS
ALTER TABLE public.volume_pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies - same company isolation
CREATE POLICY "Users can view volume pricing rules for their company"
ON public.volume_pricing_rules FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert volume pricing rules"
ON public.volume_pricing_rules FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid()) AND
  (public.get_user_role(auth.uid()) IN ('admin', 'superadmin'))
);

CREATE POLICY "Admins can update volume pricing rules"
ON public.volume_pricing_rules FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid()) AND
  (public.get_user_role(auth.uid()) IN ('admin', 'superadmin'))
);

CREATE POLICY "Admins can delete volume pricing rules"
ON public.volume_pricing_rules FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid()) AND
  (public.get_user_role(auth.uid()) IN ('admin', 'superadmin'))
);

-- Trigger for updated_at
CREATE TRIGGER update_volume_pricing_rules_updated_at
BEFORE UPDATE ON public.volume_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.volume_pricing_rules;