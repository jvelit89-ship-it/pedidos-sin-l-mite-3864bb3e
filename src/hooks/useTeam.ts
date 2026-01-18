import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface CreateTeamUserParams {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'vendedor' | 'repartidor' | 'operario';
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

interface Operario {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return false;
      }

      // Use edge function to delete vendedor and associated auth user
      const { data, error } = await supabase.functions.invoke('delete-team-user', {
        body: { teamMemberId: id, role: 'vendedor' },
      });

      if (error) {
        console.error('Error deleting vendedor:', error);
        toast.error('Error al eliminar vendedor');
        return false;
      }

      if (data?.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return false;
      }

      toast.success('Vendedor eliminado completamente');
      refetch();
      return true;
    } catch (error: any) {
      console.error('Error in deleteVendedor:', error);
      toast.error(error.message || 'Error al eliminar vendedor');
      return false;
    }
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return false;
      }

      // Use edge function to delete repartidor and associated auth user
      const { data, error } = await supabase.functions.invoke('delete-team-user', {
        body: { teamMemberId: id, role: 'repartidor' },
      });

      if (error) {
        console.error('Error deleting repartidor:', error);
        toast.error('Error al eliminar repartidor');
        return false;
      }

      if (data?.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return false;
      }

      toast.success('Repartidor eliminado completamente');
      refetch();
      return true;
    } catch (error: any) {
      console.error('Error in deleteRepartidor:', error);
      toast.error(error.message || 'Error al eliminar repartidor');
      return false;
    }
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

// Operarios hook
export function useOperarios() {
  const { data: operarios, loading, error, refetch } = useRealtimeQuery<Operario>('operarios', {
    orderBy: { column: 'name', ascending: true },
  });

  const addOperario = useCallback(async (operario: Omit<Operario, 'id' | 'created_at' | 'company_id'>) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('operarios')
      .insert({ ...operario, company_id: companyId })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear operario');
      console.error('Error creating operario:', error);
      return null;
    }
    
    toast.success('Operario creado');
    refetch();
    return data;
  }, [refetch]);

  const updateOperario = useCallback(async (id: string, updates: Partial<Operario>) => {
    const { data, error } = await supabase
      .from('operarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar operario');
      console.error('Error updating operario:', error);
      return null;
    }
    
    toast.success('Operario actualizado');
    refetch();
    return data;
  }, [refetch]);

  const deleteOperario = useCallback(async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('delete-team-user', {
        body: { teamMemberId: id, role: 'operario' },
      });

      if (error) {
        console.error('Error deleting operario:', error);
        toast.error('Error al eliminar operario');
        return false;
      }

      if (data?.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return false;
      }

      toast.success('Operario eliminado completamente');
      refetch();
      return true;
    } catch (error: any) {
      console.error('Error in deleteOperario:', error);
      toast.error(error.message || 'Error al eliminar operario');
      return false;
    }
  }, [refetch]);

  return {
    operarios,
    loading,
    error,
    refetch,
    addOperario,
    updateOperario,
    deleteOperario,
    createOperario: async (data: { name: string; email: string; phone: string; password: string; active: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return null;
      }

      const response = await supabase.functions.invoke('create-team-user', {
        body: { ...data, role: 'operario' },
      });

      if (response.error) {
        console.error('Error creating operario:', response.error);
        const errorMsg = response.error.message || 'Error al crear usuario';
        if (errorMsg.includes('already been registered') || errorMsg.includes('email_exists')) {
          toast.error('Este correo electrónico ya está registrado en el sistema');
        } else {
          toast.error(errorMsg);
        }
        return null;
      }

      if (response.data?.error) {
        const errorMsg = response.data.error as string;
        if (errorMsg.includes('already been registered') || errorMsg.includes('email_exists')) {
          toast.error('Este correo electrónico ya está registrado en el sistema');
        } else {
          toast.error(errorMsg);
        }
        return null;
      }

      toast.success('Operario creado exitosamente');
      refetch();
      return response.data.data;
    },
  };
}

// Hook for updating team member passwords
export function useUpdateTeamMemberPassword() {
  const updatePassword = useCallback(async (userId: string, newPassword: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { userId, newPassword },
      });

      if (error) {
        console.error('Error updating password:', error);
        toast.error(error.message || 'Error al actualizar contraseña');
        return false;
      }

      if (data.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error in updatePassword:', error);
      toast.error(error.message || 'Error al actualizar contraseña');
      return false;
    }
  }, []);

  return { updatePassword };
}

// Hook for updating own password (admin)
export function useUpdateOwnPassword() {
  const updateOwnPassword = useCallback(async (newPassword: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No hay sesión activa');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { newPassword, updateOwnPassword: true },
      });

      if (error) {
        console.error('Error updating password:', error);
        toast.error(error.message || 'Error al actualizar contraseña');
        return false;
      }

      if (data.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return false;
      }

      toast.success('Contraseña actualizada exitosamente');
      return true;
    } catch (error: any) {
      console.error('Error in updateOwnPassword:', error);
      toast.error(error.message || 'Error al actualizar contraseña');
      return false;
    }
  }, []);

  return { updateOwnPassword };
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
        const errorMsg = error.message || 'Error al crear usuario';
        // Translate common error messages
        if (errorMsg.includes('already been registered') || errorMsg.includes('email_exists')) {
          toast.error('Este correo electrónico ya está registrado en el sistema');
        } else {
          toast.error(errorMsg);
        }
        return null;
      }

      if (data?.error) {
        console.error('Error from function:', data.error);
        const errorMsg = data.error as string;
        // Translate common error messages
        if (errorMsg.includes('already been registered') || errorMsg.includes('email_exists')) {
          toast.error('Este correo electrónico ya está registrado en el sistema');
        } else {
          toast.error(errorMsg);
        }
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
      const errorMsg = error.message || 'Error al crear usuario';
      if (errorMsg.includes('already been registered') || errorMsg.includes('email_exists')) {
        toast.error('Este correo electrónico ya está registrado en el sistema');
      } else {
        toast.error(errorMsg);
      }
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
