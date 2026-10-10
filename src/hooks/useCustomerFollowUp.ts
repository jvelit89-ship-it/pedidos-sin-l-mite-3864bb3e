import { useEffect, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBusinessDateKey } from '@/lib/limaTime';

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

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
};

type OrderItemRow = {
  product_name: string;
  quantity: number;
};

type OrderRow = {
  customer_id: string | null;
  vendedor_id?: string | null;
  total: number | null;
  created_at: string;
  status: string;
  order_items: OrderItemRow[] | null;
};

type PurchaseDay = {
  dateKey: string;
  total: number;
  units: number;
};

function dateKeyToDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDaysToDateKey(dateKey: string, days: number): Date {
  const date = dateKeyToDate(dateKey);
  date.setDate(date.getDate() + days);
  return date;
}

export function useCustomerFollowUp() {
  const { user } = useAuth();
  const [items, setItems] = useState<CustomerFollowUpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.companyId) {
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
        const customerQuery = supabase
          .from('customers')
          .select('id, name, phone')
          .eq('company_id', user.companyId);

        let ordersQuery = supabase
          .from('orders')
          .select('customer_id, total, created_at, status, vendedor_id, order_items(product_name, quantity)')
          .eq('company_id', user.companyId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: true });

        if (user.role === 'vendedor' && user.vendedorId) {
          ordersQuery = ordersQuery.eq('vendedor_id', user.vendedorId);
        }

        const actionsPromise = user.role === 'vendedor'
          ? (supabase as any).rpc('get_customer_followup_actions')
          : Promise.resolve({ data: [], error: null });

        const [customersResult, ordersResult, actionsResult] = await Promise.all([
          customerQuery,
          ordersQuery,
          actionsPromise,
        ]);

        if (cancelled) return;

        if (customersResult.error) throw customersResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (actionsResult?.error) throw actionsResult.error;

        const customers = (customersResult.data || []) as CustomerRow[];
        const latestActions = new Map<string, {
          action_type: CustomerFollowUpActionType;
          note: string | null;
          snoozed_until: string | null;
          created_at: string;
        }>();

        for (const action of actionsResult?.data || []) {
          latestActions.set(action.customer_id, action);
        }
        const orders = (ordersResult.data || []) as unknown as OrderRow[];
        const ordersByCustomer = new Map<string, OrderRow[]>();

        for (const order of orders) {
          if (!order.customer_id) continue;
          const list = ordersByCustomer.get(order.customer_id) || [];
          list.push(order);
          ordersByCustomer.set(order.customer_id, list);
        }

        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const calculated: CustomerFollowUpItem[] = [];

        for (const customer of customers) {
          const customerOrders = ordersByCustomer.get(customer.id) || [];
          if (customerOrders.length < 2) continue;

          // Agrupamos pedidos del mismo día como una sola ocasión de compra para no
          // distorsionar la frecuencia cuando el cliente hace más de un pedido diario.
          const purchasesByDay = new Map<string, PurchaseDay>();
          const productCounts = new Map<string, number>();

          for (const order of customerOrders) {
            const dateKey = getBusinessDateKey(order.created_at);
            const existing = purchasesByDay.get(dateKey) || {
              dateKey,
              total: 0,
              units: 0,
            };

            existing.total += Number(order.total || 0);

            for (const item of order.order_items || []) {
              const quantity = Number(item.quantity || 0);
              existing.units += quantity;
              productCounts.set(
                item.product_name,
                (productCounts.get(item.product_name) || 0) + quantity
              );
            }

            purchasesByDay.set(dateKey, existing);
          }

          const purchaseDays = Array.from(purchasesByDay.values()).sort((a, b) =>
            a.dateKey.localeCompare(b.dateKey)
          );

          if (purchaseDays.length < 2) continue;

          const intervals: number[] = [];
          for (let i = 1; i < purchaseDays.length; i += 1) {
            const previous = dateKeyToDate(purchaseDays[i - 1].dateKey);
            const current = dateKeyToDate(purchaseDays[i].dateKey);
            const interval = Math.max(1, differenceInCalendarDays(current, previous));
            intervals.push(interval);
          }

          const averageDaysBetweenPurchases = Math.max(
            1,
            Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
          );

          const lastPurchase = purchaseDays[purchaseDays.length - 1];
          const nextEstimated = addDaysToDateKey(
            lastPurchase.dateKey,
            averageDaysBetweenPurchases
          );
          const daysToEstimatedPurchase = differenceInCalendarDays(nextEstimated, today);
          const upcomingWindow = Math.max(
            2,
            Math.min(7, Math.round(averageDaysBetweenPurchases * 0.25))
          );
          const riskThreshold = Math.max(
            7,
            Math.round(averageDaysBetweenPurchases * 0.5)
          );

          let status: CustomerFollowUpStatus | null = null;
          if (daysToEstimatedPurchase >= 0 && daysToEstimatedPurchase <= upcomingWindow) {
            status = 'upcoming';
          } else if (daysToEstimatedPurchase < 0) {
            const overdueDays = Math.abs(daysToEstimatedPurchase);
            status = overdueDays > riskThreshold ? 'risk' : 'overdue';
          }

          // El panel solo muestra clientes que requieren una acción comercial ahora.
          if (!status) continue;

          const totalSpent = purchaseDays.reduce((sum, purchase) => sum + purchase.total, 0);
          const totalUnits = purchaseDays.reduce((sum, purchase) => sum + purchase.units, 0);
          const favoriteProducts = Array.from(productCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);

          const latestAction = latestActions.get(customer.id);

          calculated.push({
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            status,
            averageDaysBetweenPurchases,
            lastPurchaseDate: lastPurchase.dateKey,
            nextEstimatedPurchaseDate: getBusinessDateKey(nextEstimated),
            daysToEstimatedPurchase,
            averageOrderValue: totalSpent / purchaseDays.length,
            averageUnitsPerPurchase: totalUnits / purchaseDays.length,
            lastPurchaseUnits: lastPurchase.units,
            favoriteProducts,
            purchaseCount: purchaseDays.length,
            lastActionType: latestAction?.action_type ?? null,
            lastActionAt: latestAction?.created_at ?? null,
            lastActionNote: latestAction?.note ?? null,
            snoozedUntil: latestAction?.snoozed_until ?? null,
          });
        }

        // Potencial de venta = ticket promedio estimado. Mayor potencial primero.
        calculated.sort((a, b) => b.averageOrderValue - a.averageOrderValue);
        setItems(calculated);
      } catch (err) {
        console.error('Error loading customer follow-up:', err);
        if (!cancelled) {
          setItems([]);
          setError('No se pudo calcular el seguimiento de clientes');
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
