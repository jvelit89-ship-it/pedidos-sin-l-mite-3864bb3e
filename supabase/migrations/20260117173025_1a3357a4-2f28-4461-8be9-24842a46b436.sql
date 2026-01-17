-- Create table to store OTP codes for delete verification
CREATE TABLE public.delete_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  order_ids UUID[] DEFAULT '{}',
  delete_all BOOLEAN DEFAULT false,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.delete_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can access their own OTP codes (via edge function with service role)
-- No direct access policies needed as this is managed by edge functions

-- Create index for faster lookups
CREATE INDEX idx_delete_otp_codes_user_id ON public.delete_otp_codes(user_id);
CREATE INDEX idx_delete_otp_codes_expires_at ON public.delete_otp_codes(expires_at);

-- Clean up expired OTP codes periodically (optional - can be done via cron)
COMMENT ON TABLE public.delete_otp_codes IS 'Stores temporary OTP codes for order deletion verification';