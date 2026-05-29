CREATE TABLE public.reveal_pin_otp_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    otp_code TEXT NOT NULL,
    order_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Use GRANT to set permissions for different roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reveal_pin_otp_codes TO authenticated;
GRANT ALL ON public.reveal_pin_otp_codes TO service_role;

-- Enable Row Level Security
ALTER TABLE public.reveal_pin_otp_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own reveal pin otp codes" 
ON public.reveal_pin_otp_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reveal pin otp codes" 
ON public.reveal_pin_otp_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
