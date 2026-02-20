import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrepaidPackage {
  id: string;
  customer_id: string;
  product_id: string;
  company_id: string;
  total_units: number;
  remaining_units: number;
  unit_price: number;
  amount_paid: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  // joined
  products?: { name: string; sku: string };
  customers?: { name: string };
}

export function usePrepaidPackages(customerId?: string) {
  const [packages, setPackages] = useState<PrepaidPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from('customer_prepaid_packages')
      .select('*, products(name, sku), customers(name)')
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setPackages(data || []);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const createPackage = useCallback(async (data: {
    customer_id: string;
    product_id: string;
    company_id: string;
    total_units: number;
    unit_price: number;
    amount_paid: number;
    notes?: string;
    expires_at?: string;
  }) => {
    const { error: err } = await (supabase as any)
      .from('customer_prepaid_packages')
      .insert({
        ...data,
        remaining_units: data.total_units,
        is_active: true,
      });

    if (err) {
      toast.error('Error al crear paquete prepagado');
      console.error(err);
      return false;
    }
    toast.success('Paquete prepagado creado');
    fetchPackages();
    return true;
  }, [fetchPackages]);

  const deactivatePackage = useCallback(async (packageId: string) => {
    const { error: err } = await (supabase as any)
      .from('customer_prepaid_packages')
      .update({ is_active: false })
      .eq('id', packageId);

    if (err) {
      toast.error('Error al desactivar paquete');
      return false;
    }
    toast.success('Paquete desactivado');
    fetchPackages();
    return true;
  }, [fetchPackages]);

  const getPrepaidBalance = useCallback(async (custId: string, productId: string): Promise<PrepaidPackage | null> => {
    const { data, error: err } = await (supabase as any)
      .from('customer_prepaid_packages')
      .select('*')
      .eq('customer_id', custId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .gt('remaining_units', 0)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (err || !data) return null;

    const pkg = data as PrepaidPackage;
    // Check expiry
    if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) return null;

    return pkg;
  }, []);

  const usePackageForOrder = useCallback(async (
    packageId: string,
    orderId: string,
    companyId: string,
    quantityUsed: number
  ) => {
    const { data: pkg, error: fetchErr } = await (supabase as any)
      .from('customer_prepaid_packages')
      .select('remaining_units')
      .eq('id', packageId)
      .single();

    if (fetchErr || !pkg) return false;

    const currentRemaining = pkg.remaining_units;
    const newRemaining = Math.max(0, currentRemaining - quantityUsed);

    const { error: updateErr } = await (supabase as any)
      .from('customer_prepaid_packages')
      .update({
        remaining_units: newRemaining,
        is_active: newRemaining > 0,
      })
      .eq('id', packageId);

    if (updateErr) {
      console.error('Error deducting prepaid balance:', updateErr);
      return false;
    }

    await (supabase as any)
      .from('prepaid_package_usages')
      .insert({
        package_id: packageId,
        order_id: orderId,
        company_id: companyId,
        quantity_used: quantityUsed,
      });

    return true;
  }, []);

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
    createPackage,
    deactivatePackage,
    getPrepaidBalance,
    usePackageForOrder,
  };
}
