-- Table for tracking empty containers left by distributors (pending admin approval)
CREATE TABLE public.distributor_empty_containers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    notes TEXT,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distributor_empty_containers ENABLE ROW LEVEL SECURITY;

-- Admins can manage all containers
CREATE POLICY "Admin can manage empty containers"
ON public.distributor_empty_containers
FOR ALL
USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
    AND company_id = get_user_company_id(auth.uid())
);

-- Allow public insert for distributor portal (no auth required)
CREATE POLICY "Public can insert empty containers"
ON public.distributor_empty_containers
FOR INSERT
WITH CHECK (true);

-- Allow public select for distributor portal (filtered by customer_id in edge function)
CREATE POLICY "Public can view own empty containers"
ON public.distributor_empty_containers
FOR SELECT
USING (true);