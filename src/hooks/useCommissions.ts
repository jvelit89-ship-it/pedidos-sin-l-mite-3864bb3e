import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface CommissionSetting {
  id: string;
  vendedor_id: string;
  commission_rate: number;
  company_id: string;
  created_at: string;
  updated_at: string;
}

interface VendedorCommission {
  vendedor_id: string;
  vendedor_name: string;
  commission_rate: number;
  period1_sales: number; // 1-15 del mes
  period1_commission: number;
  period2_sales: number; // 16-fin de mes
  period2_commission: number;
  total_sales: number;
  total_commission: number;
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

export function useCommissionSettings() {
  const { data: settings, loading, error, refetch } = useRealtimeQuery<CommissionSetting>('commission_settings', {
    orderBy: { column: 'created_at', ascending: false },
  });

  const setCommissionRate = useCallback(async (vendedorId: string, rate: number) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa');
      return null;
    }

    // Try to update first, if no rows affected, insert
    const { data: existing } = await supabase
      .from('commission_settings')
      .select('id')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('commission_settings')
        .update({ commission_rate: rate })
        .eq('vendedor_id', vendedorId);

      if (error) {
        toast.error('Error al actualizar comisión');
        console.error('Error updating commission:', error);
        return null;
      }
    } else {
      const { error } = await supabase
        .from('commission_settings')
        .insert({ vendedor_id: vendedorId, commission_rate: rate, company_id: companyId });

      if (error) {
        toast.error('Error al crear comisión');
        console.error('Error creating commission:', error);
        return null;
      }
    }

    toast.success('Comisión actualizada');
    refetch();
    return true;
  }, [refetch]);

  const getCommissionRate = useCallback((vendedorId: string): number => {
    const setting = settings?.find(s => s.vendedor_id === vendedorId);
    return setting?.commission_rate || 0;
  }, [settings]);

  return {
    settings,
    loading,
    error,
    refetch,
    setCommissionRate,
    getCommissionRate,
  };
}

export function useVendorCommissions(year: number, month: number) {
  const { settings } = useCommissionSettings();

  const calculateCommissions = useCallback(async (): Promise<VendedorCommission[]> => {
    const companyId = await getUserCompanyId();
    if (!companyId) return [];

    // Get all vendedores
    const { data: vendedores } = await supabase
      .from('vendedores')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('active', true);

    if (!vendedores) return [];

    // Calculate date ranges for both periods
    const period1Start = new Date(year, month - 1, 1);
    const period1End = new Date(year, month - 1, 15, 23, 59, 59);
    const period2Start = new Date(year, month - 1, 16);
    const period2End = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // Get all delivered orders for this month
    const { data: orders } = await supabase
      .from('orders')
      .select('vendedor_id, total, delivered_at')
      .eq('company_id', companyId)
      .eq('status', 'delivered')
      .gte('delivered_at', period1Start.toISOString())
      .lte('delivered_at', period2End.toISOString());

    const commissions: VendedorCommission[] = vendedores.map(vendedor => {
      const vendedorOrders = orders?.filter(o => o.vendedor_id === vendedor.id) || [];
      const rate = settings?.find(s => s.vendedor_id === vendedor.id)?.commission_rate || 0;

      // Period 1 (1-15)
      const period1Orders = vendedorOrders.filter(o => {
        const deliveredAt = new Date(o.delivered_at!);
        return deliveredAt >= period1Start && deliveredAt <= period1End;
      });
      const period1Sales = period1Orders.reduce((sum, o) => sum + o.total, 0);
      const period1Commission = period1Sales * (rate / 100);

      // Period 2 (16-end)
      const period2Orders = vendedorOrders.filter(o => {
        const deliveredAt = new Date(o.delivered_at!);
        return deliveredAt >= period2Start && deliveredAt <= period2End;
      });
      const period2Sales = period2Orders.reduce((sum, o) => sum + o.total, 0);
      const period2Commission = period2Sales * (rate / 100);

      return {
        vendedor_id: vendedor.id,
        vendedor_name: vendedor.name,
        commission_rate: rate,
        period1_sales: period1Sales,
        period1_commission: period1Commission,
        period2_sales: period2Sales,
        period2_commission: period2Commission,
        total_sales: period1Sales + period2Sales,
        total_commission: period1Commission + period2Commission,
      };
    });

    return commissions;
  }, [year, month, settings]);

  return { calculateCommissions };
}

export function useMyCommissions(vendedorId: string | null, year: number, month: number) {
  const { settings } = useCommissionSettings();

  const calculateMyCommissions = useCallback(async () => {
    if (!vendedorId) return null;

    // Calculate date ranges for both periods
    const period1Start = new Date(year, month - 1, 1);
    const period1End = new Date(year, month - 1, 15, 23, 59, 59);
    const period2Start = new Date(year, month - 1, 16);
    const period2End = new Date(year, month, 0, 23, 59, 59);

    // Get vendedor's delivered orders for this month
    const { data: orders } = await supabase
      .from('orders')
      .select('total, delivered_at')
      .eq('vendedor_id', vendedorId)
      .eq('status', 'delivered')
      .gte('delivered_at', period1Start.toISOString())
      .lte('delivered_at', period2End.toISOString());

    const rate = settings?.find(s => s.vendedor_id === vendedorId)?.commission_rate || 0;

    // Period 1 (1-15)
    const period1Orders = orders?.filter(o => {
      const deliveredAt = new Date(o.delivered_at!);
      return deliveredAt >= period1Start && deliveredAt <= period1End;
    }) || [];
    const period1Sales = period1Orders.reduce((sum, o) => sum + o.total, 0);
    const period1Commission = period1Sales * (rate / 100);

    // Period 2 (16-end)
    const period2Orders = orders?.filter(o => {
      const deliveredAt = new Date(o.delivered_at!);
      return deliveredAt >= period2Start && deliveredAt <= period2End;
    }) || [];
    const period2Sales = period2Orders.reduce((sum, o) => sum + o.total, 0);
    const period2Commission = period2Sales * (rate / 100);

    return {
      vendedor_id: vendedorId,
      commission_rate: rate,
      period1_sales: period1Sales,
      period1_commission: period1Commission,
      period2_sales: period2Sales,
      period2_commission: period2Commission,
      total_sales: period1Sales + period2Sales,
      total_commission: period1Commission + period2Commission,
    };
  }, [vendedorId, year, month, settings]);

  return { calculateMyCommissions };
}
