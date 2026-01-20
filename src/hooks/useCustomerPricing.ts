import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

export interface CustomerProductPrice {
  id: string;
  customer_id: string;
  product_id: string;
  unit_price: number;
  is_active: boolean;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  customers?: { name: string; business_name: string | null };
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

export function useCustomerPricing(customerId?: string, productId?: string) {
  const filters: { column: string; value: string }[] = [];
  if (customerId) filters.push({ column: 'customer_id', value: customerId });
  if (productId) filters.push({ column: 'product_id', value: productId });

  const { data: prices, loading, error, refetch } = useRealtimeQuery<CustomerProductPrice>(
    'customer_product_prices',
    {
      select: '*, customers(name, business_name), products(name, sku, price)',
      filter: filters.length > 0 ? filters : undefined,
      orderBy: { column: 'created_at', ascending: false },
    }
  );

  const addPrice = useCallback(async (
    customerId: string,
    productId: string,
    unitPrice: number,
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('customer_product_prices')
      .insert({
        customer_id: customerId,
        product_id: productId,
        unit_price: unitPrice,
        notes: notes || null,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Ya existe un precio especial para este cliente y producto');
      } else {
        toast.error('Error al crear precio especial');
      }
      console.error('Error creating customer price:', error);
      return null;
    }

    toast.success('Precio especial creado');
    refetch();
    return data;
  }, [refetch]);

  const updatePrice = useCallback(async (
    id: string,
    updates: Partial<Pick<CustomerProductPrice, 'unit_price' | 'is_active' | 'notes'>>
  ) => {
    const { data, error } = await supabase
      .from('customer_product_prices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Error al actualizar precio');
      console.error('Error updating customer price:', error);
      return null;
    }

    toast.success('Precio actualizado');
    refetch();
    return data;
  }, [refetch]);

  const deletePrice = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('customer_product_prices')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Error al eliminar precio');
      console.error('Error deleting customer price:', error);
      return false;
    }

    toast.success('Precio eliminado');
    refetch();
    return true;
  }, [refetch]);

  const togglePrice = useCallback(async (id: string, isActive: boolean) => {
    return updatePrice(id, { is_active: isActive });
  }, [updatePrice]);

  // Get the customer-specific price for a product
  const getCustomerPrice = useCallback((
    customerId: string,
    productId: string,
    basePrice: number,
    allPrices: CustomerProductPrice[]
  ): { price: number; hasCustomPrice: boolean; customerPrice: CustomerProductPrice | null } => {
    const customerPrice = allPrices.find(
      p => p.customer_id === customerId && p.product_id === productId && p.is_active
    );

    if (customerPrice) {
      return {
        price: customerPrice.unit_price,
        hasCustomPrice: true,
        customerPrice,
      };
    }

    return { price: basePrice, hasCustomPrice: false, customerPrice: null };
  }, []);

  return {
    prices: prices || [],
    loading,
    error,
    refetch,
    addPrice,
    updatePrice,
    deletePrice,
    togglePrice,
    getCustomerPrice,
  };
}
