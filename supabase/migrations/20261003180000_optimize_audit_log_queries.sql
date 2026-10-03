-- Performance indexes for the audit history screens.
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created_at
  ON public.audit_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_entity_action_created
  ON public.audit_logs (company_id, entity_type, action, created_at DESC);
