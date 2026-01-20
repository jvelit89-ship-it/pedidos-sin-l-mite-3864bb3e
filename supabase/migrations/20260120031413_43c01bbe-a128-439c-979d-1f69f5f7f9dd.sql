-- Add UPDATE policy for admins on production_history
CREATE POLICY "Admins can update production_history"
ON public.production_history
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
);