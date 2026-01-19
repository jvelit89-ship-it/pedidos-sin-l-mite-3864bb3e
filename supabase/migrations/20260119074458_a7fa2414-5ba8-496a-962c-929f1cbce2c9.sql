-- Drop the old percentage-based commission_settings table
DROP TABLE IF EXISTS public.commission_settings;

-- Add commission_amount column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Create commission_history table to track paid commissions
CREATE TABLE public.commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    total_units INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage commission payments"
ON public.commission_payments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.user_id
        WHERE p.user_id = auth.uid()
        AND p.company_id = commission_payments.company_id
        AND ur.role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Vendedores can view their own commission payments"
ON public.commission_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.vendedores v
        WHERE v.id = commission_payments.vendedor_id
        AND v.user_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_commission_payments_updated_at
BEFORE UPDATE ON public.commission_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();