-- Update policies for pending_production table
DROP POLICY IF EXISTS "Admins can update pending production" ON public.pending_production;
DROP POLICY IF EXISTS "Admins can delete pending production" ON public.pending_production;

-- Allow Admins and Operarios (if it's their own) to update
CREATE POLICY "Enable update for admins and owners"
ON public.pending_production
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  OR (requested_by = auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  OR (requested_by = auth.uid())
);

-- Allow Admins and Operarios (if it's their own) to delete
CREATE POLICY "Enable delete for admins and owners"
ON public.pending_production
FOR DELETE
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role))
  OR (requested_by = auth.uid())
);
