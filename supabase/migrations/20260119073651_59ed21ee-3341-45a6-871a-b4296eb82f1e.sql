-- Create commission settings table for vendors
CREATE TABLE public.commission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(vendedor_id)
);

-- Enable RLS
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage commission settings"
ON public.commission_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE p.user_id = auth.uid()
        AND p.company_id = commission_settings.company_id
        AND ur.role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Vendedores can view their own commission settings"
ON public.commission_settings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.vendedores v
        WHERE v.id = commission_settings.vendedor_id
        AND v.user_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_commission_settings_updated_at
BEFORE UPDATE ON public.commission_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();