-- Agregar política para que operarios puedan insertar en production_history
CREATE POLICY "Operario can insert production history"
ON public.production_history
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'operario'::user_role) 
  AND company_id = get_user_company_id(auth.uid())
);