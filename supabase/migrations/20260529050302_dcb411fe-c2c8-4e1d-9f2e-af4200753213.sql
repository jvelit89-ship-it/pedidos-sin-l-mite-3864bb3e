
CREATE TABLE public.mark_delivered_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  otp_code text NOT NULL,
  order_ids uuid[] NOT NULL DEFAULT '{}',
  used boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mark_delivered_otp_codes TO authenticated;
GRANT ALL ON public.mark_delivered_otp_codes TO service_role;

ALTER TABLE public.mark_delivered_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mark delivered otp"
ON public.mark_delivered_otp_codes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
