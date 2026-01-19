import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

export interface InvoiceRequest {
  id: string;
  order_id: string;
  company_id: string;
  receipt_type: 'boleta' | 'factura';
  document_type: 'dni' | 'ruc';
  document_number: string;
  customer_name: string;
  customer_address: string | null;
  status: 'pending' | 'generated' | 'sent';
  invoice_file_url: string | null;
  sent_via: 'whatsapp' | 'email' | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useInvoiceRequests() {
  const { data: requests, loading, error, refetch } = useRealtimeQuery<InvoiceRequest>(
    'invoice_requests',
    {
      orderBy: { column: 'created_at', ascending: false },
    }
  );

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  const updateRequest = useCallback(async (id: string, updates: Partial<InvoiceRequest>) => {
    const { data, error } = await supabase
      .from('invoice_requests')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Error al actualizar solicitud');
      console.error('Error updating invoice request:', error);
      return null;
    }

    return data;
  }, []);

  const markAsGenerated = useCallback(async (id: string, fileUrl?: string) => {
    return updateRequest(id, {
      status: 'generated',
      invoice_file_url: fileUrl || null,
    });
  }, [updateRequest]);

  const markAsSent = useCallback(async (id: string, via: 'whatsapp' | 'email') => {
    const result = await updateRequest(id, {
      status: 'sent',
      sent_via: via,
      sent_at: new Date().toISOString(),
    });
    if (result) {
      toast.success(`Comprobante enviado por ${via === 'whatsapp' ? 'WhatsApp' : 'Email'}`);
    }
    return result;
  }, [updateRequest]);

  return {
    requests: requests || [],
    pendingCount,
    loading,
    error,
    refetch,
    updateRequest,
    markAsGenerated,
    markAsSent,
  };
}
