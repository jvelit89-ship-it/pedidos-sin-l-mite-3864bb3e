
-- Create table for pending production that requires admin approval
CREATE TABLE public.pending_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  requested_by UUID NOT NULL,
  requested_by_name TEXT,
  company_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_production ENABLE ROW LEVEL SECURITY;

-- Operarios can insert pending production
CREATE POLICY "Operarios can insert pending production"
ON public.pending_production
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'operario') 
  AND company_id = get_user_company_id(auth.uid())
);

-- Operarios can view their own pending production
CREATE POLICY "Operarios can view own pending production"
ON public.pending_production
FOR SELECT
USING (
  requested_by = auth.uid()
  OR (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()))
  OR (has_role(auth.uid(), 'superadmin') AND company_id = get_user_company_id(auth.uid()))
);

-- Admins can update pending production (approve/reject)
CREATE POLICY "Admins can update pending production"
ON public.pending_production
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
  AND company_id = get_user_company_id(auth.uid())
);

-- Admins can delete pending production
CREATE POLICY "Admins can delete pending production"
ON public.pending_production
FOR DELETE
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
  AND company_id = get_user_company_id(auth.uid())
);
