import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CustomerMapOrder {
  customer_id: string | null;
  status: string;
  total: number;
  created_at: string;
  delivered_at: string | null;
}

export interface CustomerMapStat {
  totalOrders: number;
  pendingOrdersCount: number;
  hasPendingOrders: boolean;
  totalSpent: number;
  lastOrderDate: string | null;
}

const EMPTY_STAT: CustomerMapStat = {
  totalOrders: 0,
  pendingOrdersCount: 0,
  hasPendingOrders: false,
  totalSpent: 0,
  lastOrderDate: null,
};

export function useCustomerMapStats(companyId?: string | null) {
  const [orders, setOrders] = useState<CustomerMapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    let query = supabase
      .from('orders')
      .select('customer_id, status, total, created_at, delivered_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;

    if (error) {
      console.error('Error loading customer map statistics:', error);
    } else {
      setOrders((data || []) as CustomerMapOrder[]);
      setLastUpdatedAt(new Date());
    }

    if (!silent) setLoading(false);
  }, [companyId]);

  useEffect(() => {
    refetch(false);

    const realtimeConfig: any = {
      event: '*',
      schema: 'public',
      table: 'orders',
    };
    if (companyId) realtimeConfig.filter = `company_id=eq.${companyId}`;

    const channel = supabase
      .channel(`customer-map-orders-${companyId || 'all'}-${Date.now()}`)
      .on('postgres_changes', realtimeConfig, () => refetch(true))
      .subscribe();

    const polling = window.setInterval(() => refetch(true), 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refetch(true);
    };
    const refreshOnFocus = () => refetch(true);

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(polling);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [companyId, refetch]);

  const stats = useMemo(() => {
    const result: Record<string, CustomerMapStat & { lastOrderTimestamp: number }> = {};

    for (const order of orders) {
      if (!order.customer_id) continue;

      const current = result[order.customer_id] || {
        ...EMPTY_STAT,
        lastOrderTimestamp: 0,
      };

      current.totalOrders += 1;

      if (order.status !== 'delivered') {
        current.pendingOrdersCount += 1;
        current.hasPendingOrders = true;
      } else {
        current.totalSpent += Number(order.total) || 0;
      }

      const timestamp = new Date(order.created_at).getTime();
      if (Number.isFinite(timestamp) && timestamp > current.lastOrderTimestamp) {
        current.lastOrderTimestamp = timestamp;
        current.lastOrderDate = new Date(order.created_at).toLocaleDateString('es-PE', {
          timeZone: 'America/Lima',
        });
      }

      result[order.customer_id] = current;
    }

    return result as Record<string, CustomerMapStat>;
  }, [orders]);

  return { stats, loading, lastUpdatedAt, refetch };
}

export function getEmptyCustomerMapStat(): CustomerMapStat {
  return { ...EMPTY_STAT };
}
