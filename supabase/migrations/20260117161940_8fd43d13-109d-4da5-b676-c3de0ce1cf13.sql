-- Create simplified logs table for activity tracking
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view logs in their company"
ON public.logs
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert logs for their company"
ON public.logs
FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Admin can delete logs
CREATE POLICY "Admin can delete logs"
ON public.logs
FOR DELETE
USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

-- Enable realtime for logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;