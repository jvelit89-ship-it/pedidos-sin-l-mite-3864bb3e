import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { handleError } from '@/lib/error-handler';


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

type QueryOperator = 'eq' | 'neq' | 'in' | 'gte' | 'gt' | 'lte' | 'lt';

interface QueryOptions {
  select?: string;
  filter?: {
    column: string;
    value: string | number | boolean | Array<string | number | boolean>;
    operator?: QueryOperator;
  }[];
  or?: string;
  limit?: number;
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
          const operator = f.operator || 'eq';
          if (operator === 'in') {
            query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
          } else if (operator === 'neq') {
            query = query.neq(f.column, f.value);
          } else if (operator === 'gte') {
            query = query.gte(f.column, f.value);
          } else if (operator === 'gt') {
            query = query.gt(f.column, f.value);
          } else if (operator === 'lte') {
            query = query.lte(f.column, f.value);
          } else if (operator === 'lt') {
            query = query.lt(f.column, f.value);
          } else {
            query = query.eq(f.column, f.value);
          }
        }
      }

      if (options?.or) {
        query = query.or(options.or);
      }
      
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending ?? true 
        });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data: result, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      setData((result || []) as T[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
      handleError(err, { 
        context: `Fetch ${table}`, 
        silent: true, // Don't show toast for every background fetch error
        logToDatabase: true 
      });
    } finally {

      setLoading(false);
    }
  }, [
    table,
    options?.select,
    options?.enabled,
    options?.or,
    options?.limit,
    JSON.stringify(options?.filter),
    JSON.stringify(options?.orderBy)
  ]);

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
    if (options?.enabled === false) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;
    let channel: RealtimeChannel | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let refetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefetch = () => {
      if (refetchTimeout) {
        clearTimeout(refetchTimeout);
      }
      refetchTimeout = setTimeout(() => {
        refetchRef.current();
        refetchTimeout = null;
      }, 120);
    };

    const subscribe = () => {
      // Clean up existing channel
      if (channel) {
        supabase.removeChannel(channel);
      }

      channel = supabase
        .channel(`realtime-query-${table}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            console.log(`[Realtime] Change detected on ${table}, scheduling refresh...`);
            scheduleRefetch();
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime Query] Subscription status for ${table}: ${status}`);
          
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Start polling as fallback when realtime fails
            if (!pollingInterval) {
              console.log(`[Realtime] Starting polling fallback for ${table}`);
              pollingInterval = setInterval(() => {
                refetchRef.current();
              }, 10000); // Poll every 10 seconds
            }

            // Try to reconnect
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[Realtime] Retrying subscription for ${table} (attempt ${retryCount}/${maxRetries})`);
              retryTimeout = setTimeout(subscribe, 2000 * retryCount);
            }
          } else if (status === 'SUBSCRIBED') {
            // Connected successfully, stop polling
            retryCount = 0;
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        });
    };

    subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (refetchTimeout) {
        clearTimeout(refetchTimeout);
      }
    };
  }, [table, options?.enabled]);

  return { data, loading, error, refetch };
}
