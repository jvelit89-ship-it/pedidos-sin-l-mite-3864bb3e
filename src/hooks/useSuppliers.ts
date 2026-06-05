import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Supplier {
  id: string;
  name: string;
  business_name: string | null;
  document_type: string | null;
  ruc: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  notes: string | null;
  bank_name: string | null;
  account_number: string | null;
  cci: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierFormData {
  name: string;
  business_name?: string;
  document_type?: string;
  ruc?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  notes?: string;
  bank_name?: string;
  account_number?: string;
  cci?: string;
  is_active?: boolean;
}

export function useSuppliers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active suppliers only
  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers', user?.companyId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', user?.companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user?.companyId,
  });

  // Fetch all suppliers (including inactive)
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ['suppliers', user?.companyId, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', user?.companyId)
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user?.companyId,
  });

  // Create supplier
  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .insert({
          name: data.name,
          business_name: data.business_name || null,
          document_type: data.document_type || 'ruc',
          ruc: data.ruc || null,
          address: data.address || null,
          city: data.city || null,
          phone: data.phone || null,
          email: data.email || null,
          contact_name: data.contact_name || null,
          notes: data.notes || null,
          bank_name: data.bank_name || null,
          account_number: data.account_number || null,
          cci: data.cci || null,
          is_active: data.is_active ?? true,
          company_id: user?.companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return result as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Proveedor creado',
        description: 'El proveedor se ha registrado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update supplier
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SupplierFormData }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: data.name,
          business_name: data.business_name || null,
          document_type: data.document_type || 'ruc',
          ruc: data.ruc || null,
          address: data.address || null,
          city: data.city || null,
          phone: data.phone || null,
          email: data.email || null,
          contact_name: data.contact_name || null,
          notes: data.notes || null,
          bank_name: data.bank_name || null,
          account_number: data.account_number || null,
          cci: data.cci || null,
          is_active: data.is_active ?? true,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Proveedor actualizado',
        description: 'Los cambios se han guardado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle supplier status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: variables.is_active ? 'Proveedor activado' : 'Proveedor desactivado',
        description: variables.is_active 
          ? 'El proveedor ahora está disponible para compras.'
          : 'El proveedor ya no aparecerá en nuevas compras.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Check if supplier has purchases
  const checkSupplierHasPurchases = async (supplierId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId);

    if (error) {
      console.error('Error checking purchases:', error);
      return false;
    }

    return (count || 0) > 0;
  };

  return {
    suppliers,
    allSuppliers,
    loadingSuppliers,
    createSupplier: createMutation.mutateAsync,
    updateSupplier: (id: string, data: SupplierFormData) => 
      updateMutation.mutateAsync({ id, data }),
    toggleSupplierStatus: (id: string, is_active: boolean) =>
      toggleStatusMutation.mutateAsync({ id, is_active }),
    checkSupplierHasPurchases,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isTogglingStatus: toggleStatusMutation.isPending,
  };
}
