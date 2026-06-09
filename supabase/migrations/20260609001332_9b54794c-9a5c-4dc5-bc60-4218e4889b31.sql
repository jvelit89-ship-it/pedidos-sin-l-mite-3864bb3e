-- Create or replace function to set company_id on logs
CREATE OR REPLACE FUNCTION public.set_log_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on logs
DROP TRIGGER IF EXISTS trg_set_log_company_id ON public.logs;
CREATE TRIGGER trg_set_log_company_id
BEFORE INSERT ON public.logs
FOR EACH ROW EXECUTE FUNCTION public.set_log_company_id();

-- Update pending_production RLS to allow admins and vendedores to also submit for approval if needed
-- (The user mentioned even admins should have to go through approval)
DROP POLICY IF EXISTS "Operarios can insert pending production" ON public.pending_production;
CREATE POLICY "Users can insert pending production" ON public.pending_production
FOR INSERT TO authenticated
WITH CHECK (
  (company_id = get_user_company_id(auth.uid()))
);

-- Ensure all public tables have GRANTS to authenticated
GRANT ALL ON public.pending_production TO authenticated;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;
