import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface DistributorCredit {
  id: string;
  customer_id: string;
  company_id: string;
  package_name: string;
  total_credits: number;
  remaining_credits: number;
  amount_paid: number;
  purchase_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    name: string;
    phone: string | null;
  };
}

interface CreditUsage {
  id: string;
  credit_id: string;
  company_id: string;
  quantity: number;
  registered_by: string | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    name: string;
  };
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

export function useDistributorCredits(customerId?: string) {
  const { data: credits, loading, error, refetch } = useRealtimeQuery<DistributorCredit>('distributor_credits', {
    select: '*, customers(name, phone)',
    filter: customerId ? [{ column: 'customer_id', value: customerId }] : undefined,
    orderBy: { column: 'purchase_date', ascending: false },
  });

  const addCreditPackage = useCallback(async (
    customerId: string,
    packageName: string,
    totalCredits: number,
    amountPaid: number,
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('distributor_credits')
      .insert({
        customer_id: customerId,
        company_id: companyId,
        package_name: packageName,
        total_credits: totalCredits,
        remaining_credits: totalCredits,
        amount_paid: amountPaid,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding credit package:', error);
      toast.error('Error al registrar paquete de créditos');
      return null;
    }

    toast.success('Paquete de créditos registrado');
    refetch();
    return data;
  }, [refetch]);

  const deactivatePackage = useCallback(async (creditId: string) => {
    const { error } = await supabase
      .from('distributor_credits')
      .update({ is_active: false })
      .eq('id', creditId);

    if (error) {
      console.error('Error deactivating package:', error);
      toast.error('Error al desactivar paquete');
      return false;
    }

    toast.success('Paquete desactivado');
    refetch();
    return true;
  }, [refetch]);

  return {
    credits: credits || [],
    loading,
    error,
    refetch,
    addCreditPackage,
    deactivatePackage,
  };
}

export function useCreditUsage(creditId?: string) {
  const { data: usage, loading, error, refetch } = useRealtimeQuery<CreditUsage>('distributor_credit_usage', {
    select: '*, profiles(name)',
    filter: creditId ? [{ column: 'credit_id', value: creditId }] : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });

  const registerPickup = useCallback(async (
    creditId: string,
    quantity: number,
    productId: string, // The product being picked up (e.g., "Recarga 20L")
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Get current credit info
    const { data: credit } = await supabase
      .from('distributor_credits')
      .select('remaining_credits')
      .eq('id', creditId)
      .single();

    if (!credit) {
      toast.error('Paquete de créditos no encontrado');
      return false;
    }

    if (credit.remaining_credits < quantity) {
      toast.error(`Solo quedan ${credit.remaining_credits} recargas disponibles`);
      return false;
    }

    // Register the pickup
    const { error: usageError } = await supabase
      .from('distributor_credit_usage')
      .insert({
        credit_id: creditId,
        company_id: companyId,
        quantity,
        registered_by: user?.id || null,
        notes: notes || null,
      });

    if (usageError) {
      console.error('Error registering pickup:', usageError);
      toast.error('Error al registrar recojo');
      return false;
    }

    // Update remaining credits
    const newRemaining = credit.remaining_credits - quantity;
    const { error: updateError } = await supabase
      .from('distributor_credits')
      .update({ 
        remaining_credits: newRemaining,
        is_active: newRemaining > 0 
      })
      .eq('id', creditId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
    }

    // Deduct from product stock
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (product) {
      const newStock = Math.max(0, product.stock - quantity);
      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      // Create stock movement
      await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          company_id: companyId,
          movement_type: 'sale',
          quantity: -quantity,
          reference_id: creditId,
          notes: `Entrega distribuidor: ${notes || 'Sin notas'}`,
        });
    }

    toast.success(`${quantity} recargas registradas`);
    refetch();
    return true;
  }, [refetch]);

  return {
    usage: usage || [],
    loading,
    error,
    refetch,
    registerPickup,
  };
}

export function useDistributorSummary() {
  const { credits } = useDistributorCredits();
  
  const getDistributorStats = useCallback((customerId: string) => {
    const customerCredits = credits.filter(c => c.customer_id === customerId);
    const activeCredits = customerCredits.filter(c => c.is_active);
    
    const totalPurchased = customerCredits.reduce((acc, c) => acc + c.total_credits, 0);
    const totalRemaining = activeCredits.reduce((acc, c) => acc + c.remaining_credits, 0);
    const totalPaid = customerCredits.reduce((acc, c) => acc + Number(c.amount_paid), 0);
    
    return {
      totalPurchased,
      totalRemaining,
      totalUsed: totalPurchased - totalRemaining,
      totalPaid,
      activePackages: activeCredits.length,
    };
  }, [credits]);

  return { getDistributorStats };
}
