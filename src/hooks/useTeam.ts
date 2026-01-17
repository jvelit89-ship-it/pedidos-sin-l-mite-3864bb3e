import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface CreateTeamUserParams {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'vendedor' | 'repartidor';
  zone?: string;
  active: boolean;
}

interface Vendedor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean | null;
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
  active: boolean | null;
  user_id: string | null;
  company_id: string;
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

export function useVendedores() {
  const { data: vendedores, loading, error, refetch } = useRealtimeQuery<Vendedor>('vendedores', {
    orderBy: { column: 'name', ascending: true },
  });

  const addVendedor = useCallback(async (vendedor: Omit<Vendedor, 'id' | 'created_at' | 'company_id'>) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('vendedores')
      .insert({ ...vendedor, company_id: companyId })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear vendedor');
      console.error('Error creating vendedor:', error);
      return null;
    }
    
    toast.success('Vendedor creado');
    refetch();
    return data;
  }, [refetch]);

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
    refetch();
    return data;
  }, [refetch]);

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
    refetch();
    return true;
  }, [refetch]);

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

  const addRepartidor = useCallback(async (repartidor: Omit<Repartidor, 'id' | 'created_at' | 'company_id'>) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('repartidores')
      .insert({ ...repartidor, company_id: companyId })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear repartidor');
      console.error('Error creating repartidor:', error);
      return null;
    }
    
    toast.success('Repartidor creado');
    refetch();
    return data;
  }, [refetch]);

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
    refetch();
    return data;
  }, [refetch]);

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
    refetch();
    return true;
  }, [refetch]);

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

  const createTeamUser = useCallback(async (params: CreateTeamUserParams) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return null;
      }

      const { data, error } = await supabase.functions.invoke('create-team-user', {
        body: params,
      });

      if (error) {
        console.error('Error creating team user:', error);
        toast.error(error.message || 'Error al crear usuario');
        return null;
      }

      if (data.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return null;
      }

      toast.success(`${params.role === 'vendedor' ? 'Vendedor' : 'Repartidor'} creado exitosamente`);
      
      // Refetch data
      if (params.role === 'vendedor') {
        vendedoresHook.refetch();
      } else {
        repartidoresHook.refetch();
      }

      return data.data;
    } catch (error: any) {
      console.error('Error in createTeamUser:', error);
      toast.error(error.message || 'Error al crear usuario');
      return null;
    }
  }, [vendedoresHook.refetch, repartidoresHook.refetch]);

  return {
    vendedores: vendedoresHook.vendedores,
    repartidores: repartidoresHook.repartidores,
    loading: vendedoresHook.loading || repartidoresHook.loading,
    createVendedor: async (data: { name: string; email: string; phone: string; password: string; active: boolean }) => {
      return createTeamUser({ ...data, role: 'vendedor' });
    },
    updateVendedor: vendedoresHook.updateVendedor,
    deleteVendedor: vendedoresHook.deleteVendedor,
    createRepartidor: async (data: { name: string; email: string; phone: string; password: string; zone?: string; active: boolean }) => {
      return createTeamUser({ ...data, role: 'repartidor' });
    },
    updateRepartidor: repartidoresHook.updateRepartidor,
    deleteRepartidor: repartidoresHook.deleteRepartidor,
  };
}
