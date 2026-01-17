import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCompanies() {
  const { data: companies, loading, error, refetch } = useRealtimeQuery<Company>('companies', {
    orderBy: { column: 'name', ascending: true },
  });

  const addCompany = useCallback(async (company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear empresa');
      console.error('Error creating company:', error);
      return null;
    }
    
    toast.success('Empresa creada');
    return data;
  }, []);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar empresa');
      console.error('Error updating company:', error);
      return null;
    }
    
    toast.success('Empresa actualizada');
    return data;
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar empresa');
      console.error('Error deleting company:', error);
      return false;
    }
    
    toast.success('Empresa eliminada');
    return true;
  }, []);

  return {
    companies,
    loading,
    error,
    refetch,
    addCompany,
    updateCompany,
    deleteCompany,
  };
}
