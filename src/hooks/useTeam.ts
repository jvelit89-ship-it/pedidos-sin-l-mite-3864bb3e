import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface Vendedor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  user_id: string | null;
  company_id: string;
  created_at: string;
}

interface Repartidor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  zone: string | null;
  active: boolean;
  user_id: string | null;
  company_id: string;
  created_at: string;
}

export function useVendedores() {
  const { data: vendedores, loading, error, refetch } = useRealtimeQuery<Vendedor>('vendedores', {
    orderBy: { column: 'name', ascending: true },
  });

  const addVendedor = useCallback(async (vendedor: Omit<Vendedor, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('vendedores')
      .insert(vendedor)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear vendedor');
      console.error('Error creating vendedor:', error);
      return null;
    }
    
    toast.success('Vendedor creado');
    return data;
  }, []);

  const updateVendedor = useCallback(async (id: string, updates: Partial<Vendedor>) => {
    const { data, error } = await supabase
      .from('vendedores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar vendedor');
      console.error('Error updating vendedor:', error);
      return null;
    }
    
    toast.success('Vendedor actualizado');
    return data;
  }, []);

  const deleteVendedor = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('vendedores')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar vendedor');
      console.error('Error deleting vendedor:', error);
      return false;
    }
    
    toast.success('Vendedor eliminado');
    return true;
  }, []);

  return {
    vendedores,
    loading,
    error,
    refetch,
    addVendedor,
    updateVendedor,
    deleteVendedor,
  };
}

export function useRepartidores() {
  const { data: repartidores, loading, error, refetch } = useRealtimeQuery<Repartidor>('repartidores', {
    orderBy: { column: 'name', ascending: true },
  });

  const addRepartidor = useCallback(async (repartidor: Omit<Repartidor, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('repartidores')
      .insert(repartidor)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear repartidor');
      console.error('Error creating repartidor:', error);
      return null;
    }
    
    toast.success('Repartidor creado');
    return data;
  }, []);

  const updateRepartidor = useCallback(async (id: string, updates: Partial<Repartidor>) => {
    const { data, error } = await supabase
      .from('repartidores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar repartidor');
      console.error('Error updating repartidor:', error);
      return null;
    }
    
    toast.success('Repartidor actualizado');
    return data;
  }, []);

  const deleteRepartidor = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('repartidores')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar repartidor');
      console.error('Error deleting repartidor:', error);
      return false;
    }
    
    toast.success('Repartidor eliminado');
    return true;
  }, []);

  return {
    repartidores,
    loading,
    error,
    refetch,
    addRepartidor,
    updateRepartidor,
    deleteRepartidor,
  };
}

// Combined hook for convenience
export function useTeam() {
  const vendedoresHook = useVendedores();
  const repartidoresHook = useRepartidores();

  return {
    vendedores: vendedoresHook.vendedores,
    repartidores: repartidoresHook.repartidores,
    loading: vendedoresHook.loading || repartidoresHook.loading,
    createVendedor: async (data: { name: string; email: string; phone: string; active: boolean }) => {
      const { data: profile } = await supabase.from('profiles').select('company_id').maybeSingle();
      return vendedoresHook.addVendedor({ ...data, company_id: profile?.company_id || '', user_id: null });
    },
    updateVendedor: vendedoresHook.updateVendedor,
    deleteVendedor: vendedoresHook.deleteVendedor,
    createRepartidor: async (data: { name: string; email: string; phone: string; zone: string | null; active: boolean }) => {
      const { data: profile } = await supabase.from('profiles').select('company_id').maybeSingle();
      return repartidoresHook.addRepartidor({ ...data, company_id: profile?.company_id || '', user_id: null });
    },
    updateRepartidor: repartidoresHook.updateRepartidor,
    deleteRepartidor: repartidoresHook.deleteRepartidor,
  };
}
