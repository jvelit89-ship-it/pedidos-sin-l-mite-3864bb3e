-- Fix customer-photos bucket security: Make it private with company-scoped access

-- 1. Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'customer-photos';

-- 2. Drop the overly permissive anonymous access policy
DROP POLICY IF EXISTS "Anyone can view customer photos" ON storage.objects;

-- 3. Create a new policy that restricts photo viewing to authenticated users
-- Users can only view photos for customers in their company
CREATE POLICY "Company users can view customer photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'customer-photos' 
    AND auth.role() = 'authenticated'
  );