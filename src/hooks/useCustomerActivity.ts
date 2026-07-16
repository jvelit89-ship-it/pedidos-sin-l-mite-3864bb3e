import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ActivityTier = 'green' | 'yellow' | 'red';

export interface ActivityInfo {
  count: number;
  tier: ActivityTier;
}

// Thresholds: pedidos entregados en los últimos 90 días
// 🟢 Verde: >= 10 (alto volumen)
// 🟡 Amarillo: 3 - 9 (intermedio)
// 🔴 Rojo: 0 - 2 (bajo o inactivo)
export const ACTIVITY_THRESHOLDS = {
  greenMin: 10,
  yellowMin: 3,
};

export function classifyActivity(count: number): ActivityTier {
  if (count >= ACTIVITY_THRESHOLDS.greenMin) return 'green';
  if (count >= ACTIVITY_THRESHOLDS.yellowMin) return 'yellow';
  return 'red';
}

export function useCustomerActivity() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<Record<string, ActivityInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data, error } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('company_id', user.companyId)
        .eq('status', 'delivered')
        .gte('created_at', since.toISOString());

      if (cancelled) return;
      if (error || !data) {
        setActivity({});
        setLoading(false);
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of data as Array<{ customer_id: string | null }>) {
        if (!row.customer_id) continue;
        counts[row.customer_id] = (counts[row.customer_id] || 0) + 1;
      }
      const map: Record<string, ActivityInfo> = {};
      for (const [id, count] of Object.entries(counts)) {
        map[id] = { count, tier: classifyActivity(count) };
      }
      setActivity(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.companyId]);

  return { activity, loading };
}
