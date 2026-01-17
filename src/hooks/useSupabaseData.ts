import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SupabaseTable = 
  | 'companies' 
  | 'profiles' 
  | 'user_roles' 
  | 'products' 
  | 'production_history'
  | 'customers' 
  | 'vendedores' 
  | 'repartidores' 
  | 'orders' 
  | 'order_items' 
  | 'audit_logs'
  | 'app_settings';

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
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old as T);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onInsert, onUpdate, onDelete]);
}

export function useRealtimeQuery<T>(table: SupabaseTable, options?: QueryOptions) {
  const { data, loading, error, refetch } = useSupabaseQuery<T>(table, options);

  useSupabaseRealtime<T>(
    table,
    () => refetch(),
    () => refetch(),
    () => refetch()
  );

  return { data, loading, error, refetch };
}
