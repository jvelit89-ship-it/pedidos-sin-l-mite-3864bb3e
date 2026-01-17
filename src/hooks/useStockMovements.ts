import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth } from 'date-fns';

interface StockMovement {
  id: string;
  product_id: string;
  company_id: string;
  movement_type: 'production' | 'sale' | 'adjustment';
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    name: string;
    sku: string;
  };
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

export function useStockMovements() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const companyId = await getUserCompanyId();
    if (!companyId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching stock movements:', fetchError);
      setError(fetchError);
    } else {
      setMovements(data as StockMovement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const addMovement = useCallback(async (
    productId: string,
    movementType: 'production' | 'sale' | 'adjustment',
    quantity: number,
    referenceId?: string,
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        company_id: companyId,
        movement_type: movementType,
        quantity,
        reference_id: referenceId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding stock movement:', error);
      return null;
    }

    fetchMovements();
    return data;
  }, [fetchMovements]);

  return {
    movements,
    loading,
    error,
    refetch: fetchMovements,
    addMovement,
  };
}

export function useStockReports() {
  const getReportByPeriod = useCallback(async (period: 'day' | 'week' | 'month') => {
    const companyId = await getUserCompanyId();
    if (!companyId) return null;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'day':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
    }

    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku)')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching report:', error);
      return null;
    }

    return data as StockMovement[];
  }, []);

  const getProductSummary = useCallback(async (period: 'day' | 'week' | 'month') => {
    const movements = await getReportByPeriod(period);
    if (!movements) return null;

    const summary: Record<string, {
      productName: string;
      productSku: string;
      produced: number;
      sold: number;
      adjusted: number;
      net: number;
    }> = {};

    movements.forEach((m) => {
      if (!summary[m.product_id]) {
        summary[m.product_id] = {
          productName: m.products?.name || 'Producto',
          productSku: m.products?.sku || '',
          produced: 0,
          sold: 0,
          adjusted: 0,
          net: 0,
        };
      }

      switch (m.movement_type) {
        case 'production':
          summary[m.product_id].produced += m.quantity;
          summary[m.product_id].net += m.quantity;
          break;
        case 'sale':
          summary[m.product_id].sold += Math.abs(m.quantity);
          summary[m.product_id].net += m.quantity;
          break;
        case 'adjustment':
          summary[m.product_id].adjusted += m.quantity;
          summary[m.product_id].net += m.quantity;
          break;
      }
    });

    return Object.values(summary);
  }, [getReportByPeriod]);

  return {
    getReportByPeriod,
    getProductSummary,
  };
}
