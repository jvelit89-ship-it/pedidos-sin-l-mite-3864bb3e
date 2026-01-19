-- Drop the dangerous permissive RLS policy on orders table
DROP POLICY IF EXISTS "Allow public read via tracking code" ON public.orders;

-- Add RLS policy to delete_otp_codes table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delete_otp_codes' AND policyname = 'Users can only access own OTP codes'
  ) THEN
    CREATE POLICY "Users can only access own OTP codes"
    ON public.delete_otp_codes
    FOR ALL
    USING (user_id = auth.uid());
  END IF;
END $$;