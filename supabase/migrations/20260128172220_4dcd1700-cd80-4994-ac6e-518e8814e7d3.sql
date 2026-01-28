-- Create table for restore OTP codes
CREATE TABLE IF NOT EXISTS public.restore_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  otp_code TEXT NOT NULL,
  backup_data JSONB NOT NULL,
  selected_tables TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restore_otp_codes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own OTP codes
CREATE POLICY "Users can manage own restore OTP codes"
ON public.restore_otp_codes
FOR ALL
USING (user_id = auth.uid());