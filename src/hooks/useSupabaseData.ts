import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SupabaseTable = 
  | 'companies' 
  | 'profiles' 
  | 'user_roles' 
  | 'products' 
  | 'production_history'
  | 'customers' 
  | 'vendedores' 
  | 'repartidores'
  | 'operarios'
  | 'orders' 
  | 'order_items' 
  | 'audit_logs'
  | 'app_settings'
  | 'logs'
  | 'stock_movements'
  | 'volume_pricing_rules'
  | 'invoice_requests'
  | 'commission_payments'
  | 'distributor_credits'
  | 'distributor_credit_usage'
  | 'production_recipes'
  | 'production_waste'
  | 'customer_product_prices';

interface QueryOptions {
  select?: string;
  filter?: { column: string; value: string | number | boolean }[];
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
}

export function useSupabaseQuery<T>(table: SupabaseTable, options?: QueryOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query using any to avoid deep type instantiation
      const selectStr = options?.select || '*';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(table).select(selectStr);
      
      if (options?.filter) {
        for (const f of options.filter) {
          query = query.eq(f.column, f.value);
        }
      }
      
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending ?? true 
        });
      }
      
      const { data: result, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      setData((result || []) as T[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
      console.error(`Error fetching ${table}:`, err);
    } finally {
      setLoading(false);
    }
  }, [table, options?.select, options?.enabled, JSON.stringify(options?.filter), JSON.stringify(options?.orderBy)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useSupabaseRealtime<T>(
  table: SupabaseTable,
  onInsert?: (payload: T) => void,
  onUpdate?: (payload: T) => void,
  onDelete?: (payload: T) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          console.log(`[Realtime] INSERT on ${table}:`, payload);
          if (onInsert) onInsert(payload.new as T);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          console.log(`[Realtime] UPDATE on ${table}:`, payload);
          if (onUpdate) onUpdate(payload.new as T);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          console.log(`[Realtime] DELETE on ${table}:`, payload);
          if (onDelete) onDelete(payload.old as T);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status for ${table}: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, onInsert, onUpdate, onDelete]);
}

export function useRealtimeQuery<T>(table: SupabaseTable, options?: QueryOptions) {
  const { data, loading, error, refetch } = useSupabaseQuery<T>(table, options);

  // Use refs to avoid recreating subscription on refetch changes
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-query-${table}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          console.log(`[Realtime] Change detected on ${table}, refreshing data...`);
          refetchRef.current();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime Query] Subscription status for ${table}: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);

  return { data, loading, error, refetch };
}
