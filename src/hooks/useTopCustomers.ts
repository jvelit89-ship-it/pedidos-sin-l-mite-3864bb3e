import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfMonth } from 'date-fns';

export interface TopCustomerItem {

  id: string;
  name: string;
  business_name: string | null;
  total_spent: number;
  total_orders: number;
  total_units: number;
}

export interface TopCustomersOptions {
  startDate?: Date;
  endDate?: Date;
  productId?: string;
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

export function useTopCustomers() {
  const [data, setData] = useState<TopCustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopCustomers = useCallback(async (options: TopCustomersOptions) => {
    setLoading(true);
    setError(null);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        setError('No se encontró la empresa del usuario');
        return [];
      }

      const start = options.startDate ? startOfDay(options.startDate) : startOfMonth(new Date());
      const end = options.endDate ? endOfDay(options.endDate) : endOfDay(new Date());

      let query = supabase
        .from('order_items')
        .select(`
          quantity,
          total,
          orders!inner(id, customer_id, customer_name, status, created_at, company_id)
        `)
        .eq('orders.company_id', companyId)
        .eq('orders.status', 'delivered')
        .gte('orders.created_at', start.toISOString())
        .lte('orders.created_at', end.toISOString());

      if (options.productId && options.productId !== 'all') {
        query = query.eq('product_id', options.productId);
      }

      const { data: rawData, error: queryError } = await query;

      if (queryError) {
        console.error('Error fetching top customers:', queryError);
        setError('Error al obtener los datos de clientes');
        return [];
      }

      // Fetch customer business names
      const customerIds = [...new Set((rawData || []).map((r: any) => r.orders.customer_id))];
      let businessNameMap: Record<string, string | null> = {};
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, business_name')
          .in('id', customerIds);
        customers?.forEach(c => { businessNameMap[c.id] = c.business_name; });
      }

      // Aggregate by customer
      const aggregated: Record<string, TopCustomerItem & { orderIds: Set<string> }> = {};
      (rawData || []).forEach((item: any) => {
        const cid = item.orders.customer_id;
        if (!aggregated[cid]) {
          aggregated[cid] = {
            id: cid,
            name: item.orders.customer_name,
            business_name: businessNameMap[cid] || null,
            total_spent: 0,
            total_orders: 0,
            total_units: 0,
            orderIds: new Set(),
          };
        }
        aggregated[cid].total_spent += Number(item.total);
        aggregated[cid].total_units += item.quantity;
        aggregated[cid].orderIds.add(item.orders.id);
      });

      const result = Object.values(aggregated)
        .map(item => ({
          ...item,
          total_orders: item.orderIds.size,
        }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 100);

      setData(result);
      return result;
    } catch (err) {
      console.error('Unexpected error in top customers report:', err);
      setError('Error inesperado');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchTopCustomers };
}
