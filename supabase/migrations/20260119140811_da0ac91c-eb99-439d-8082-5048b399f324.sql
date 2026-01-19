-- Add 'distribuidor' to customer_type enum
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'distribuidor';

-- Create distributor credit packages table (tracks prepaid purchases)
CREATE TABLE public.distributor_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL, -- e.g., "S/2000 x 500 recargas"
  total_credits INTEGER NOT NULL, -- Total recargas purchased
  remaining_credits INTEGER NOT NULL, -- Remaining recargas
  amount_paid NUMERIC(10,2) NOT NULL, -- Amount paid
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit usage history (tracks each pickup)
CREATE TABLE public.distributor_credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.distributor_credits(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL, -- Number of recargas picked up
  registered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create production recipes table (defines what materials are needed for production)
CREATE TABLE public.production_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  output_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, -- Product being produced
  input_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, -- Material required
  quantity_ratio NUMERIC(10,4) NOT NULL DEFAULT 1, -- How many inputs per output (usually 1:1)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(output_product_id, input_product_id)
);

-- Create production waste/defects table (tracks failed units)
CREATE TABLE public.production_waste (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, -- The material that was wasted
  quantity INTEGER NOT NULL, -- How many units failed
  reason TEXT, -- Why they failed
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.distributor_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_waste ENABLE ROW LEVEL SECURITY;

-- RLS for distributor_credits (Admin only for write, distributors can view their own)
CREATE POLICY "Admin can manage distributor credits"
ON public.distributor_credits
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- RLS for distributor_credit_usage (Admin only for write)
CREATE POLICY "Admin can manage credit usage"
ON public.distributor_credit_usage
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- RLS for production_recipes (Admin can manage)
CREATE POLICY "Admin can manage production recipes"
ON public.production_recipes
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Company users can view recipes"
ON public.production_recipes
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- RLS for production_waste (Admin and Operario can manage)
CREATE POLICY "Admin and Operario can manage production waste"
ON public.production_waste
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role) OR has_role(auth.uid(), 'operario'::user_role))
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Company users can view production waste"
ON public.production_waste
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_distributor_credits_updated_at
BEFORE UPDATE ON public.distributor_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_credits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_credit_usage;