import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

export interface VolumePricingRule {
  id: string;
  product_id: string;
  min_quantity: number;
  unit_price: number;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
  products?: { name: string; sku: string; price: number };
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

export function useVolumePricing(productId?: string) {
  const { data: rules, loading, error, refetch } = useRealtimeQuery<VolumePricingRule>(
    'volume_pricing_rules',
    {
      select: '*, products(name, sku, price)',
      filter: productId ? [{ column: 'product_id', value: productId }] : undefined,
      orderBy: { column: 'min_quantity', ascending: true },
    }
  );

  const addRule = useCallback(async (
    productId: string,
    minQuantity: number,
    unitPrice: number
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('volume_pricing_rules')
      .insert({
        product_id: productId,
        min_quantity: minQuantity,
        unit_price: unitPrice,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) {
      toast.error('Error al crear regla de precio');
      console.error('Error creating volume pricing rule:', error);
      return null;
    }

    toast.success('Regla de precio creada');
    refetch();
    return data;
  }, [refetch]);

  const updateRule = useCallback(async (
    id: string,
    updates: Partial<Pick<VolumePricingRule, 'min_quantity' | 'unit_price' | 'is_active'>>
  ) => {
    const { data, error } = await supabase
      .from('volume_pricing_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Error al actualizar regla');
      console.error('Error updating volume pricing rule:', error);
      return null;
    }

    toast.success('Regla actualizada');
    refetch();
    return data;
  }, [refetch]);

  const deleteRule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('volume_pricing_rules')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error al eliminar regla');
      console.error('Error deleting volume pricing rule:', error);
      return false;
    }

    toast.success('Regla eliminada');
    refetch();
    return true;
  }, [refetch]);

  const toggleRule = useCallback(async (id: string, isActive: boolean) => {
    return updateRule(id, { is_active: isActive });
  }, [updateRule]);

  // Calculate the applicable unit price based on quantity
  const getApplicablePrice = useCallback((
    productId: string,
    quantity: number,
    basePrice: number,
    allRules: VolumePricingRule[]
  ): { price: number; appliedRule: VolumePricingRule | null; discount: number } => {
    // Filter active rules for this product, sorted by min_quantity descending
    const productRules = allRules
      .filter(r => r.product_id === productId && r.is_active)
      .sort((a, b) => b.min_quantity - a.min_quantity);

    // Find the first rule where quantity meets the minimum
    const appliedRule = productRules.find(r => quantity >= r.min_quantity);

    if (appliedRule) {
      const discount = basePrice - appliedRule.unit_price;
      return {
        price: appliedRule.unit_price,
        appliedRule,
        discount,
      };
    }

    return { price: basePrice, appliedRule: null, discount: 0 };
  }, []);

  return {
    rules: rules || [],
    loading,
    error,
    refetch,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    getApplicablePrice,
  };
}
