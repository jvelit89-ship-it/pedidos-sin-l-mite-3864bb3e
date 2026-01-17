import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';

interface Log {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  company_id: string;
  created_at: string;
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

export function useLogs() {
  const { data: logs, loading, error, refetch } = useRealtimeQuery<Log>('logs', {
    orderBy: { column: 'created_at', ascending: false },
  });

  const addLog = useCallback(async (
    action: string,
    entity: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = await getUserCompanyId();
    
    if (!companyId) {
      console.error('No company found for user');
      return null;
    }

    const logEntry = {
      user_id: user?.id || null,
      action,
      entity,
      entity_id: entityId || null,
      details: details || null,
      company_id: companyId,
    };

    const { data, error } = await supabase
      .from('logs')
      .insert(logEntry as any)
      .select()
      .single();
    
    if (error) {
      console.error('Error adding log:', error);
      return null;
    }
    
    return data;
  }, []);

  return {
    logs,
    loading,
    error,
    refetch,
    addLog,
  };
}
