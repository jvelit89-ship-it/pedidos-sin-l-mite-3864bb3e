import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';
import { handleError } from '@/lib/error-handler';
import { useAuth } from '@/contexts/AuthContext';


interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  stock: number;
  reserved_stock: number;
  min_stock: number;
  stock_critical_level: number;
  price: number;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  product_type: 'final' | 'raw_material';
  image_url?: string | null;
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

interface ProductionHistoryWithProfile extends ProductionHistory {
  products?: { name: string };
  producer_name?: string;
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

/**
 * Verifica que exista suficiente stock de materia prima para producir `quantity`
 * unidades de `productId` según sus recetas activas. Devuelve la lista de faltantes.
 */
export async function checkRecipeStock(
  productId: string,
  quantity: number,
  companyId: string
): Promise<{ ok: boolean; missing: { name: string; required: number; available: number }[] }> {
  const { data: recipes, error } = await supabase
    .from('production_recipes')
    .select('quantity_ratio, input_product_id, products:input_product_id(name, stock)')
    .eq('output_product_id', productId)
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error || !recipes) return { ok: true, missing: [] };

  const missing: { name: string; required: number; available: number }[] = [];
  for (const r of recipes as any[]) {
    const required = Number(r.quantity_ratio) * quantity;
    const available = Number(r.products?.stock ?? 0);
    if (available < required) {
      missing.push({
        name: r.products?.name ?? 'Material',
        required,
        available,
      });
    }
  }
  return { ok: missing.length === 0, missing };
}

export function useProducts() {
  const { user } = useAuth();
  const { data: products, loading, error, refetch } = useRealtimeQuery<Product>('products', {
    filter: user?.companyId ? [{ column: 'company_id', value: user.companyId }] : undefined,
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
      handleError(error, { context: 'Create Product' });
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
      handleError(error, { context: 'Update Product' });
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
      handleError(error, { context: 'Delete Product' });
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
      handleError(error, { context: 'Update Stock' });
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
  const { data: rawHistory, loading: historyLoading, error, refetch } = useRealtimeQuery<ProductionHistory & { products?: { name: string } }>('production_history', {
    select: '*, products(name)',
    filter: productId ? [{ column: 'product_id', value: productId }] : undefined,
    orderBy: { column: 'produced_at', ascending: false },
  });

  const [history, setHistory] = useState<ProductionHistoryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch profile names for produced_by UUIDs
  useEffect(() => {
    async function enrichWithProfileNames() {
      if (!rawHistory || rawHistory.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs that are not null
      const userIds = [...new Set(rawHistory.map(h => h.produced_by).filter(Boolean))] as string[];
      
      if (userIds.length === 0) {
        setHistory(rawHistory.map(h => ({ ...h, producer_name: undefined })));
        setLoading(false);
        return;
      }

      // Fetch profiles for these user IDs
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      // Create a map of user_id -> name
      const profileMap = new Map<string, string>();
      profiles?.forEach(p => {
        profileMap.set(p.user_id, p.name);
      });

      // Enrich history with producer names
      const enrichedHistory = rawHistory.map(h => ({
        ...h,
        producer_name: h.produced_by ? profileMap.get(h.produced_by) : undefined,
      }));

      setHistory(enrichedHistory);
      setLoading(false);
    }

    setLoading(historyLoading);
    if (!historyLoading) {
      enrichWithProfileNames();
    }
  }, [rawHistory, historyLoading]);

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

    // Get current user and role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      handleError(authError || new Error('User not found'), { context: 'Add Production (Auth)' });
      return false;
    }


    // Fetch role from user_roles
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const role = roleData?.role || 'vendedor';
    const isSuperAdmin = role === 'superadmin';

    // Everyone except SuperAdmin must use the pending production flow
    if (!isSuperAdmin) {
      console.log(`[Production] User role ${role} detected, sending to pending approval`);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const { error: pendingError } = await supabase
        .from('pending_production')
        .insert({
          product_id: productId,
          quantity,
          notes: notes || null,
          requested_by: user.id,
          requested_by_name: profile?.name || 'Usuario',
          company_id: companyId,
          status: 'pending',
        });

      if (pendingError) {
        handleError(pendingError, { context: 'Submit Production Approval' });
        return false;
      }

      toast.success('Producción enviada para aprobación');
      return true;
    }

    // Admins continue with direct production
    const producedBy = user.id;
    
    console.log('[Production] Registering production:', {
      productId,
      quantity,
      producedBy,
      userId: user.id,
    });

    // SOLO insertamos el registro de producción
    // El trigger auto_update_stock_on_production_insert se encarga
    // AUTOMÁTICAMENTE de actualizar el stock del producto
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
      handleError(historyError, { context: 'Add Production History' });
      return false;
    }


    // Registrar movimiento de stock para trazabilidad
    await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        company_id: companyId,
        movement_type: 'production',
        quantity: quantity,
        reference_id: productionData?.id || null,
        notes: notes || null,
      });

    // El stock ya fue actualizado por el trigger, no necesitamos hacerlo manualmente
    toast.success('Producción registrada');
    
    // Refetch para actualizar la UI
    await Promise.all([
      refetch(),
      refetchProducts(),
    ]);
    
    return true;
  }, [refetch, refetchProducts]);

  const updateProduction = useCallback(async (
    id: string,
    updates: { quantity?: number; notes?: string; produced_at?: string },
    oldQuantity: number,
    productId: string
  ) => {
    // El trigger auto_update_stock_on_production_update se encarga
    // AUTOMÁTICAMENTE de ajustar el stock cuando cambia la cantidad

    const { error } = await supabase
      .from('production_history')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      handleError(error, { context: 'Update Production' });
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
