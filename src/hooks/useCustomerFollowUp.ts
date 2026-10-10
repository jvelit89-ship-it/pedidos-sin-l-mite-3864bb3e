import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CustomerFollowUpStatus = 'upcoming' | 'overdue' | 'risk';
export type CustomerFollowUpActionType =
  | 'managed'
  | 'no_response'
  | 'snoozed'
  | 'whatsapp'
  | 'called'
  | 'order_started';

export interface CustomerFollowUpItem {
  customerId: string;
  customerName: string;
  phone: string | null;
  status: CustomerFollowUpStatus;
  averageDaysBetweenPurchases: number;
  lastPurchaseDate: string;
  nextEstimatedPurchaseDate: string;
  daysToEstimatedPurchase: number;
  averageOrderValue: number;
  averageUnitsPerPurchase: number;
  lastPurchaseUnits: number;
  favoriteProducts: string[];
  purchaseCount: number;
  lastActionType: CustomerFollowUpActionType | null;
  lastActionAt: string | null;
  lastActionNote: string | null;
  snoozedUntil: string | null;
}

type OpportunityRpcRow = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  status: CustomerFollowUpStatus;
  average_days_between_purchases: number;
  last_purchase_date: string;
  next_estimated_purchase_date: string;
  days_to_estimated_purchase: number;
  average_order_value: number | string;
  average_units_per_purchase: number | string;
  last_purchase_units: number | string;
  favorite_products: string[] | null;
  purchase_count: number;
  last_action_type: CustomerFollowUpActionType | null;
  last_action_at: string | null;
  last_action_note: string | null;
  snoozed_until: string | null;
};

export function useCustomerFollowUp() {
  const { user } = useAuth();
  const [items, setItems] = useState<CustomerFollowUpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.companyId || user.role !== 'vendedor' || !user.vendedorId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await (supabase as any).rpc(
          'get_customer_followup_opportunities',
        );

        if (cancelled) return;
        if (rpcError) throw rpcError;

        const mapped = ((data || []) as OpportunityRpcRow[]).map((row) => ({
          customerId: row.customer_id,
          customerName: row.customer_name,
          phone: row.phone,
          status: row.status,
          averageDaysBetweenPurchases: Number(row.average_days_between_purchases || 1),
          lastPurchaseDate: row.last_purchase_date,
          nextEstimatedPurchaseDate: row.next_estimated_purchase_date,
          daysToEstimatedPurchase: Number(row.days_to_estimated_purchase || 0),
          averageOrderValue: Number(row.average_order_value || 0),
          averageUnitsPerPurchase: Number(row.average_units_per_purchase || 0),
          lastPurchaseUnits: Number(row.last_purchase_units || 0),
          favoriteProducts: row.favorite_products || [],
          purchaseCount: Number(row.purchase_count || 0),
          lastActionType: row.last_action_type,
          lastActionAt: row.last_action_at,
          lastActionNote: row.last_action_note,
          snoozedUntil: row.snoozed_until,
        }));

        setItems(mapped);
      } catch (err) {
        console.error('Error loading customer follow-up:', err);
        if (!cancelled) {
          setItems([]);
          setError('No se pudo cargar las oportunidades de venta');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.companyId, user?.role, user?.vendedorId, refreshKey]);

  const refetch = () => setRefreshKey((value) => value + 1);

  return { items, loading, error, refetch };
}
