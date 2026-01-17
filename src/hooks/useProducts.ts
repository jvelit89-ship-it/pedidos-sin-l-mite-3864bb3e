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

export function useProducts() {
  const { data: products, loading, error, refetch } = useRealtimeQuery<Product>('products', {
    orderBy: { column: 'name', ascending: true },
  });

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear producto');
      console.error('Error creating product:', error);
      return null;
    }
    
    toast.success('Producto creado');
    return data;
  }, []);

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
    
    toast.success('Producto actualizado');
    return data;
  }, []);

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
    return true;
  }, []);

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
    
    return data;
  }, []);

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
  const { data: history, loading, error, refetch } = useRealtimeQuery<ProductionHistory & { products?: { name: string } }>('production_history', {
    select: '*, products(name)',
    filter: productId ? [{ column: 'product_id', value: productId }] : undefined,
    orderBy: { column: 'produced_at', ascending: false },
  });

  const addProduction = useCallback(async (
    productId: string, 
    quantity: number, 
    companyId: string,
    notes?: string
  ) => {
    // First, add production record
    const { error: historyError } = await supabase
      .from('production_history')
      .insert({
        product_id: productId,
        quantity,
        company_id: companyId,
        notes,
      });
    
    if (historyError) {
      toast.error('Error al registrar producción');
      console.error('Error adding production:', historyError);
      return false;
    }

    // Then, update the product stock
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (product) {
      const newStock = product.stock + quantity;
      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);
    }
    
    toast.success('Producción registrada');
    refetch();
    return true;
  }, [refetch]);

  return {
    history,
    loading,
    error,
    refetch,
    addProduction,
  };
}
