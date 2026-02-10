import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TruckExtraLoad {
  id: string;
  repartidor_id: string;
  company_id: string;
  status: 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
  notes: string | null;
}

export interface TruckExtraLoadItem {
  id: string;
  load_id: string;
  product_id: string;
  company_id: string;
  quantity_loaded: number;
  quantity_sold: number;
  quantity_returned: number;
  product_name?: string;
  product_sku?: string;
}

export function useTruckExtraLoad() {
  const { user } = useAuth();
  const [activeLoad, setActiveLoad] = useState<TruckExtraLoad | null>(null);
  const [loadItems, setLoadItems] = useState<TruckExtraLoadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const companyId = user?.companyId;
  const repartidorId = user?.repartidorId;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchActiveLoad = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('truck_extra_loads' as any)
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (repartidorId && !isAdmin) {
        query = query.eq('repartidor_id', repartidorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const load = (data as any)?.[0] as TruckExtraLoad | undefined;
      setActiveLoad(load || null);

      if (load) {
        await fetchLoadItems(load.id);
      } else {
        setLoadItems([]);
      }
    } catch (err) {
      console.error('Error fetching active load:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, repartidorId, isAdmin]);

  const fetchLoadItems = async (loadId: string) => {
    const { data, error } = await supabase
      .from('truck_extra_load_items' as any)
      .select('*')
      .eq('load_id', loadId);

    if (error) {
      console.error('Error fetching load items:', error);
      return;
    }

    // Enrich with product names
    const items = (data as any[]) || [];
    if (items.length > 0) {
      const productIds = items.map(i => i.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);

      const productMap = new Map((products || []).map(p => [p.id, p]));
      const enriched = items.map(item => ({
        ...item,
        product_name: productMap.get(item.product_id)?.name || 'Producto',
        product_sku: productMap.get(item.product_id)?.sku || '',
      }));
      setLoadItems(enriched);
    } else {
      setLoadItems([]);
    }
  };

  useEffect(() => {
    fetchActiveLoad();
  }, [fetchActiveLoad]);

  const createLoad = async (
    targetRepartidorId: string,
    items: { productId: string; quantity: number }[],
    notes?: string
  ) => {
    if (!companyId) return;

    try {
      // Create the load
      const { data: loadData, error: loadError } = await supabase
        .from('truck_extra_loads' as any)
        .insert({
          repartidor_id: targetRepartidorId,
          company_id: companyId,
          status: 'active',
          notes: notes || null,
        } as any)
        .select()
        .single();

      if (loadError) throw loadError;
      const load = loadData as any;

      // Insert items (trigger will deduct stock)
      const itemRows = items.map(i => ({
        load_id: load.id,
        product_id: i.productId,
        company_id: companyId,
        quantity_loaded: i.quantity,
        quantity_sold: 0,
        quantity_returned: 0,
      }));

      const { error: itemsError } = await supabase
        .from('truck_extra_load_items' as any)
        .insert(itemRows as any);

      if (itemsError) throw itemsError;

      toast.success('Carga extra registrada', {
        description: `${items.length} producto(s) cargados al camión`,
      });

      await fetchActiveLoad();
    } catch (err: any) {
      console.error('Error creating load:', err);
      toast.error('Error al crear carga extra', { description: err.message });
    }
  };

  const registerSale = async (itemId: string, quantitySold: number) => {
    try {
      const item = loadItems.find(i => i.id === itemId);
      if (!item) throw new Error('Item no encontrado');

      const remaining = item.quantity_loaded - item.quantity_sold;
      if (quantitySold > remaining) {
        toast.error('No puedes vender más de lo disponible');
        return;
      }

      const { error } = await supabase
        .from('truck_extra_load_items' as any)
        .update({ quantity_sold: item.quantity_sold + quantitySold } as any)
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Venta registrada');
      if (activeLoad) await fetchLoadItems(activeLoad.id);
    } catch (err: any) {
      console.error('Error registering sale:', err);
      toast.error('Error al registrar venta', { description: err.message });
    }
  };

  const closeLoad = async () => {
    if (!activeLoad) return;

    try {
      const { error } = await supabase.rpc('close_truck_extra_load', {
        _load_id: activeLoad.id,
      } as any);

      if (error) throw error;

      toast.success('Carga cerrada', {
        description: 'Los productos no vendidos se devolvieron al almacén',
      });

      await fetchActiveLoad();
    } catch (err: any) {
      console.error('Error closing load:', err);
      toast.error('Error al cerrar carga', { description: err.message });
    }
  };

  return {
    activeLoad,
    loadItems,
    loading,
    createLoad,
    registerSale,
    closeLoad,
    refreshLoad: fetchActiveLoad,
  };
}
