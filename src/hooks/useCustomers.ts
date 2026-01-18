import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: 'regular' | 'premium' | 'vip';
  notes: string | null;
  company_id: string;
  facade_photo_url: string | null;
  vendedor_id: string | null;
  created_at: string;
  updated_at: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
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

export function useCustomers() {
  const { data: customers, loading, error, refetch } = useRealtimeQuery<Customer>('customers', {
    orderBy: { column: 'name', ascending: true },
  });

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customer, company_id: companyId })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al crear cliente');
      console.error('Error creating customer:', error);
      return null;
    }
    
    toast.success('Cliente creado');
    refetch();
    return data;
  }, [refetch]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      toast.error('Error al actualizar cliente');
      console.error('Error updating customer:', error);
      return null;
    }
    
    toast.success('Cliente actualizado');
    refetch();
    return data;
  }, [refetch]);

  const deleteCustomer = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar cliente');
      console.error('Error deleting customer:', error);
      return false;
    }
    
    toast.success('Cliente eliminado');
    refetch();
    return true;
  }, [refetch]);

  return {
    customers,
    loading,
    error,
    refetch,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  };
}

// Geocoding hook using OpenStreetMap Nominatim
export function useGeocoding() {
  const searchAddress = useCallback(async (query: string): Promise<NominatimResult[]> => {
    if (!query || query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const results = await response.json();
      return results;
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );
      
      if (!response.ok) throw new Error('Reverse geocoding failed');
      
      const result = await response.json();
      return result.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }, []);

  return { searchAddress, reverseGeocode };
}
