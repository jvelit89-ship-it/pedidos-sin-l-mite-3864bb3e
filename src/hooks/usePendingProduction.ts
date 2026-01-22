import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Create an untyped client for the new table
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const untypedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PendingProduction {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  requested_by: string;
  requested_by_name: string | null;
  company_id: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

async function getUserCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  return profile?.company_id || null;
}

export function usePendingProduction() {
  const [pendingItems, setPendingItems] = useState<PendingProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        setPendingItems([]);
        setLoading(false);
        return;
      }

      // Sync session to untyped client
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await untypedClient.auth.setSession(session);
      }

      const { data, error } = await untypedClient
        .from('pending_production')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending production:', error);
        setPendingItems([]);
        return;
      }

      setPendingItems((data as PendingProduction[]) || []);
    } catch (error) {
      console.error('Error:', error);
      setPendingItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Check for duplicate submission (same product, quantity within 30 seconds)
  const checkDuplicate = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Sync session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await untypedClient.auth.setSession(session);
    }

    // Check in pending_production
    const { data: pendingDuplicates } = await untypedClient
      .from('pending_production')
      .select('id')
      .eq('product_id', productId)
      .eq('quantity', quantity)
      .eq('requested_by', user.id)
      .gte('created_at', thirtySecondsAgo);

    if (pendingDuplicates && pendingDuplicates.length > 0) {
      return true;
    }

    // Also check in production_history
    const { data: historyDuplicates } = await supabase
      .from('production_history')
      .select('id')
      .eq('product_id', productId)
      .eq('quantity', quantity)
      .eq('produced_by', user.id)
      .gte('produced_at', thirtySecondsAgo);

    return historyDuplicates && historyDuplicates.length > 0;
  }, []);

  // Submit production for approval (operarios)
  const submitForApproval = useCallback(async (
    productId: string,
    quantity: number,
    notes?: string
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      // Check for duplicates first
      const isDuplicate = await checkDuplicate(productId, quantity);
      if (isDuplicate) {
        toast.error('Registro duplicado detectado. Por favor espera 30 segundos antes de registrar el mismo producto y cantidad.');
        return false;
      }

      const companyId = await getUserCompanyId();
      if (!companyId) {
        toast.error('Error: No se encontró la empresa');
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Error: Usuario no autenticado');
        return false;
      }

      // Get user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      // Sync session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await untypedClient.auth.setSession(session);
      }

      const { error } = await untypedClient
        .from('pending_production')
        .insert({
          product_id: productId,
          quantity,
          notes: notes || null,
          requested_by: user.id,
          requested_by_name: profile?.name || 'Operario',
          company_id: companyId,
          status: 'pending',
        });

      if (error) {
        console.error('Error submitting for approval:', error);
        toast.error('Error al enviar para aprobación');
        return false;
      }

      toast.success('Producción enviada para aprobación del administrador');
      fetchPending();
      return true;
    } finally {
      setSubmitting(false);
    }
  }, [checkDuplicate, fetchPending]);

  // Approve production (admins only)
  const approveProduction = useCallback(async (pendingId: string): Promise<boolean> => {
    try {
      // Sync session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await untypedClient.auth.setSession(session);
      }

      // Get pending item details
      const { data: pending, error: fetchError } = await untypedClient
        .from('pending_production')
        .select('*')
        .eq('id', pendingId)
        .single();

      if (fetchError || !pending) {
        toast.error('Registro no encontrado');
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Add to production_history
      const { data: productionData, error: historyError } = await supabase
        .from('production_history')
        .insert({
          product_id: pending.product_id,
          quantity: pending.quantity,
          company_id: pending.company_id,
          notes: pending.notes,
          produced_by: pending.requested_by,
        })
        .select()
        .single();

      if (historyError) {
        console.error('Error creating production:', historyError);
        toast.error('Error al crear registro de producción');
        return false;
      }

      // Add stock movement
      await supabase
        .from('stock_movements')
        .insert({
          product_id: pending.product_id,
          company_id: pending.company_id,
          movement_type: 'production',
          quantity: pending.quantity,
          reference_id: productionData?.id || null,
          notes: pending.notes,
        });

      // Update product stock
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', pending.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ stock: product.stock + pending.quantity })
          .eq('id', pending.product_id);
      }

      // Mark as approved
      await untypedClient
        .from('pending_production')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', pendingId);

      toast.success('Producción aprobada y registrada');
      fetchPending();
      return true;
    } catch (error) {
      console.error('Error approving production:', error);
      toast.error('Error al aprobar producción');
      return false;
    }
  }, [fetchPending]);

  // Reject production (admins only)
  const rejectProduction = useCallback(async (pendingId: string, reason?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Sync session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await untypedClient.auth.setSession(session);
      }

      const { error } = await untypedClient
        .from('pending_production')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason || null,
        })
        .eq('id', pendingId);

      if (error) {
        toast.error('Error al rechazar producción');
        return false;
      }

      toast.success('Producción rechazada');
      fetchPending();
      return true;
    } catch (error) {
      console.error('Error rejecting production:', error);
      toast.error('Error al rechazar');
      return false;
    }
  }, [fetchPending]);

  // Delete pending production
  const deletePending = useCallback(async (pendingId: string): Promise<boolean> => {
    // Sync session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await untypedClient.auth.setSession(session);
    }

    const { error } = await untypedClient
      .from('pending_production')
      .delete()
      .eq('id', pendingId);

    if (error) {
      toast.error('Error al eliminar');
      return false;
    }

    toast.success('Registro eliminado');
    fetchPending();
    return true;
  }, [fetchPending]);

  const pendingCount = pendingItems.filter((p) => p.status === 'pending').length;

  return {
    pendingItems,
    pendingCount,
    loading,
    submitting,
    refetch: fetchPending,
    submitForApproval,
    approveProduction,
    rejectProduction,
    deletePending,
    checkDuplicate,
  };
}
