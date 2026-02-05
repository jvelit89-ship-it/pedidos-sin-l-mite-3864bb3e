
-- Create table for commission deletion OTP codes
CREATE TABLE public.commission_delete_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  otp_code TEXT NOT NULL,
  commission_type TEXT NOT NULL, -- 'vendedor' or 'operario'
  target_id UUID NOT NULL, -- vendedor_id or operario_id
  target_name TEXT NOT NULL,
  record_ids UUID[] NOT NULL, -- order_ids for vendedores, production_ids for operarios
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  period INTEGER, -- 1 or 2, null for both
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_delete_otp_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert their own commission delete OTP codes"
ON public.commission_delete_otp_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own commission delete OTP codes"
ON public.commission_delete_otp_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own commission delete OTP codes"
ON public.commission_delete_otp_codes FOR UPDATE
USING (auth.uid() = user_id);
