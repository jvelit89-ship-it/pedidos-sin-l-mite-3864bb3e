-- Actionable seller follow-up workflow for the dashboard opportunity panel.
CREATE TABLE IF NOT EXISTS public.customer_followup_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  note text,
  snoozed_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_followup_actions_type_check
    CHECK (action_type IN ('managed','no_response','snoozed','whatsapp','called','order_started'))
);

CREATE INDEX IF NOT EXISTS idx_customer_followup_actions_vendor_created
  ON public.customer_followup_actions(vendedor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_followup_actions_customer_created
  ON public.customer_followup_actions(customer_id, created_at DESC);

ALTER TABLE public.customer_followup_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_followup_actions_select_own ON public.customer_followup_actions;
CREATE POLICY customer_followup_actions_select_own
ON public.customer_followup_actions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.id = customer_followup_actions.vendedor_id
      AND v.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.record_customer_followup_action(
  p_customer_id uuid,
  p_action_type text,
  p_note text DEFAULT NULL,
  p_snoozed_until date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_vendedor_id uuid;
  current_company_id uuid;
  action_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF p_action_type NOT IN ('managed','no_response','snoozed','whatsapp','called','order_started') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE' USING ERRCODE = '22023';
  END IF;

  SELECT v.id, v.company_id
    INTO current_vendedor_id, current_company_id
  FROM public.vendedores v
  WHERE v.user_id = current_user_id
    AND coalesce(v.active, true) = true
  LIMIT 1;

  IF current_vendedor_id IS NULL THEN
    RAISE EXCEPTION 'SELLER_PROFILE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
      AND o.vendedor_id = current_vendedor_id
      AND o.company_id = current_company_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_ASSIGNED_TO_SELLER' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.customer_followup_actions(
    company_id,
    customer_id,
    vendedor_id,
    user_id,
    action_type,
    note,
    snoozed_until
  )
  VALUES (
    current_company_id,
    p_customer_id,
    current_vendedor_id,
    current_user_id,
    p_action_type,
    NULLIF(trim(coalesce(p_note, '')), ''),
    p_snoozed_until
  )
  RETURNING id INTO action_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', action_id,
    'customer_id', p_customer_id,
    'action_type', p_action_type,
    'snoozed_until', p_snoozed_until,
    'created_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_customer_followup_action(uuid,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_followup_action(uuid,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_followup_actions()
RETURNS TABLE (
  customer_id uuid,
  action_type text,
  note text,
  snoozed_until date,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH current_seller AS (
    SELECT v.id
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND coalesce(v.active, true) = true
    LIMIT 1
  ),
  ranked AS (
    SELECT
      a.customer_id,
      a.action_type,
      a.note,
      a.snoozed_until,
      a.created_at,
      row_number() OVER (
        PARTITION BY a.customer_id
        ORDER BY a.created_at DESC
      ) AS rn
    FROM public.customer_followup_actions a
    JOIN current_seller s ON s.id = a.vendedor_id
    WHERE a.created_at >= now() - interval '45 days'
  )
  SELECT
    ranked.customer_id,
    ranked.action_type,
    ranked.note,
    ranked.snoozed_until,
    ranked.created_at
  FROM ranked
  WHERE ranked.rn = 1;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_followup_actions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_followup_actions() TO authenticated;

COMMENT ON TABLE public.customer_followup_actions IS
  'Seller actions taken from the Oportunidades de Venta dashboard: managed, no response, snooze and contact actions.';

NOTIFY pgrst, 'reload schema';
