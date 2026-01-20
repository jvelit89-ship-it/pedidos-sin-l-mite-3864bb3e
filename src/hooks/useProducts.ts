import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  stock: number;
  min_stock: number;
  price: number;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

interface ProductionHistory {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  produced_by: string | null;
  company_id: string;
  produced_at: string;
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

export function useProducts() {
  const { data: products, loading, error, refetch } = useRealtimeQuery<Product>('products', {
    orderBy: { column: 'name', ascending: true },
  });

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, company_id: companyId })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear producto');
      console.error('Error creating product:', error);
      return null;
    }
    
    toast.success('Producto creado');
    refetch();
    return data;
  }, [refetch]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar producto');
      console.error('Error updating product:', error);
      return null;
    }
    
    refetch();
    return data;
  }, [refetch]);

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar producto');
      console.error('Error deleting product:', error);
      return false;
    }
    
    toast.success('Producto eliminado');
    refetch();
    return true;
  }, [refetch]);

  const updateStock = useCallback(async (id: string, quantity: number) => {
    const { data, error } = await supabase
      .from('products')
      .update({ stock: quantity })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar stock');
      console.error('Error updating stock:', error);
      return null;
    }
    
    refetch();
    return data;
  }, [refetch]);

  return {
    products,
    loading,
    error,
    refetch,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStock,
  };
}

export function useProductionHistory(productId?: string) {
  const { data: history, loading, error, refetch } = useRealtimeQuery<ProductionHistory & { products?: { name: string }; profiles?: { name: string } }>('production_history', {
    select: '*, products(name), profiles!production_history_produced_by_fkey(name)',
    filter: productId ? [{ column: 'product_id', value: productId }] : undefined,
    orderBy: { column: 'produced_at', ascending: false },
  });

  const { refetch: refetchProducts } = useProducts();

  const addProduction = useCallback(async (
    productId: string, 
    quantity: number, 
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return false;
    }

    // Get current user id
    const { data: { user } } = await supabase.auth.getUser();
    const producedBy = user?.id || null;

    // First, add production record
    const { data: productionData, error: historyError } = await supabase
      .from('production_history')
      .insert({
        product_id: productId,
        quantity,
        company_id: companyId,
        notes: notes || null,
        produced_by: producedBy,
      })
      .select()
      .single();
    
    if (historyError) {
      toast.error('Error al registrar producción');
      console.error('Error adding production:', historyError);
      return false;
    }

    // Add stock movement record
    await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        company_id: companyId,
        movement_type: 'production',
        quantity: quantity, // positive for production
        reference_id: productionData?.id || null,
        notes: notes || null,
      });

    // Then, update the product stock
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (product) {
      const newStock = product.stock + quantity;
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);
      
      if (updateError) {
        console.error('Error updating stock:', updateError);
      }
    }
    
    toast.success('Producción registrada');
    refetch();
    refetchProducts();
    return true;
  }, [refetch, refetchProducts]);

  const updateProduction = useCallback(async (
    id: string,
    updates: { quantity?: number; notes?: string; produced_at?: string },
    oldQuantity: number,
    productId: string
  ) => {
    // Calculate stock adjustment if quantity changed
    if (updates.quantity !== undefined && updates.quantity !== oldQuantity) {
      const quantityDiff = updates.quantity - oldQuantity;
      
      // Update product stock
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();
      
      if (product) {
        const newStock = product.stock + quantityDiff;
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId);
      }
    }

    const { error } = await supabase
      .from('production_history')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Error al actualizar producción');
      console.error('Error updating production:', error);
      return false;
    }
    
    toast.success('Producción actualizada');
    refetch();
    refetchProducts();
    return true;
  }, [refetch, refetchProducts]);

  return {
    history,
    loading,
    error,
    refetch,
    addProduction,
    updateProduction,
  };
}
