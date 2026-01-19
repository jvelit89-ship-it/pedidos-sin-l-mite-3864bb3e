-- Table to track invoice/receipt requests that need admin attention
CREATE TABLE public.invoice_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('boleta', 'factura')),
  document_type TEXT NOT NULL CHECK (document_type IN ('dni', 'ruc')),
  document_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent')),
  invoice_file_url TEXT,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view all invoice requests for their company
CREATE POLICY "Admins can view invoice requests"
ON public.invoice_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'superadmin')
);

-- Admins can update invoice requests (mark as generated/sent)
CREATE POLICY "Admins can update invoice requests"
ON public.invoice_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'superadmin')
);

-- Allow inserting invoice requests when creating orders (for vendedor and admin)
CREATE POLICY "Staff can create invoice requests"
ON public.invoice_requests
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'superadmin') OR
  public.has_role(auth.uid(), 'vendedor')
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_requests;

-- Add index for faster queries
CREATE INDEX idx_invoice_requests_status ON public.invoice_requests(status);
CREATE INDEX idx_invoice_requests_company ON public.invoice_requests(company_id);