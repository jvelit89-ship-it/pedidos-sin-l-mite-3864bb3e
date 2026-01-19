-- Create table for production delete OTP codes
CREATE TABLE public.production_delete_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  otp_code TEXT NOT NULL,
  production_ids UUID[] DEFAULT NULL,
  delete_all BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_delete_otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own OTP codes
CREATE POLICY "Users can read their own production delete OTP codes"
  ON public.production_delete_otp_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own OTP codes  
CREATE POLICY "Users can insert their own production delete OTP codes"
  ON public.production_delete_otp_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own OTP codes
CREATE POLICY "Users can update their own production delete OTP codes"
  ON public.production_delete_otp_codes
  FOR UPDATE
  USING (auth.uid() = user_id);