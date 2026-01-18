-- 1. Add 'operario' role to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'operario';

-- 2. Create operarios table for the new role
CREATE TABLE IF NOT EXISTS public.operarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on operarios
ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;

-- RLS policies for operarios
CREATE POLICY "Users can view operarios of their company" ON public.operarios
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Admins can insert operarios" ON public.operarios
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can update operarios" ON public.operarios
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can delete operarios" ON public.operarios
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 3. Add facade_photo_url and vendedor_id to customers table
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS facade_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL;

-- 4. Create storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('customer-photos', 'customer-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for customer photos
CREATE POLICY "Anyone can view customer photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'customer-photos');

CREATE POLICY "Authenticated users can upload customer photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update customer photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete customer photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'customer-photos' AND auth.role() = 'authenticated');