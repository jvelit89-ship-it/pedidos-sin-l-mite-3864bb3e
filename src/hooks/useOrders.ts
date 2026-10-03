import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';
import { handleError } from '@/lib/error-handler';
import { useAuth } from '@/contexts/AuthContext';
import { OrderStatus } from '@/types';
import { getRecentValidatedDeliveryLocation } from '@/lib/deliveryGeoValidation';
import { getBusinessDayUtcRange, getTodayBusinessDateKey } from '@/lib/limaTime';

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  total: number;
  status: OrderStatus;
  vendedor_id: string | null;
  vendedor_name: string | null;
  repartidor_id: string | null;
  repartidor_name: string | null;
  delivery_date: string | null;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  tracking_code: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_distance_m?: number | null;
  delivery_pin_verified_at?: string | null;
  
  customers?: {
    customer_type: string | null;
    phone: string | null;
  };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export type OrdersQueryMode = 'all' | 'orders-page' | 'deliveries' | 'dashboard';

export interface UseOrdersOptions {
  mode?: OrdersQueryMode;
  historyDate?: string;
  dashboardDateFilter?: 'today' | 'week' | 'all' | string;
  enabled?: boolean;
}

const OPERATIONAL_STATUSES: OrderStatus[] = [
  'pending',
  'preparation',
  'ready',
  'delivery',
  'backorder',
];

const getCompletedDayClauses = (dateKey: string) => {
  const { start, end } = getBusinessDayUtcRange(dateKey);
  return [
    `and(status.eq.delivered,delivered_at.gte.${start},delivered_at.lt.${end})`,
    `and(status.eq.cancelled,created_at.gte.${start},created_at.lt.${end})`,
  ];
};

export function useOrders(options: UseOrdersOptions = {}) {
  const { user } = useAuth();
  const mode = options.mode || 'all';

  let orFilter: string | undefined;

  if (mode === 'orders-page') {
    const today = getTodayBusinessDateKey();
    const selectedHistoryDate = options.historyDate || today;
    const dates = Array.from(new Set([today, selectedHistoryDate]));
    const clauses = [
      `status.in.(${OPERATIONAL_STATUSES.join(',')})`,
      ...dates.flatMap(getCompletedDayClauses),
    ];
    orFilter = clauses.join(',');
  } else if (mode === 'deliveries') {
    const today = getTodayBusinessDateKey();
    orFilter = [
      'status.in.(ready,delivery)',
      ...getCompletedDayClauses(today),
    ].join(',');
  } else if (mode === 'dashboard' && options.dashboardDateFilter !== 'all') {
    const today = getTodayBusinessDateKey();
    const { start: todayStart } = getBusinessDayUtcRange(today);
    const thirtyDaysAgo = new Date(
      new Date(todayStart).getTime() - 29 * 24 * 60 * 60 * 1000
    ).toISOString();

    orFilter = [
      `status.in.(${OPERATIONAL_STATUSES.join(',')})`,
      `created_at.gte.${thirtyDaysAgo}`,
      `delivered_at.gte.${thirtyDaysAgo}`,
    ].join(',');
  }

  const filters: Array<{
    column: string;
    value: string | number | boolean;
  }> = [];

  if (user?.companyId) {
    filters.push({ column: 'company_id', value: user.companyId });
  }

  if (mode === 'deliveries' && user?.role === 'repartidor' && user.repartidorId) {
    filters.push({ column: 'repartidor_id', value: user.repartidorId });
  }

  const { data: orders, loading, error, refetch } = useRealtimeQuery<OrderWithItems>('orders', {
    select: '*, order_items(*), customers(customer_type, phone)',
    filter: filters.length > 0 ? filters : undefined,
    or: orFilter,
    orderBy: { column: 'created_at', ascending: false },
    enabled: options.enabled,
  });

  const getOrder = useCallback(async (id: string): Promise<OrderWithItems | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), customers(customer_type, phone)')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      handleError(error, { context: 'Fetch Order', silent: true });
      return null;
    }

    
    return data;
  }, []);

  const createOrder = useCallback(async (
    order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'delivered_at' | 'tracking_code'> & { created_at?: string },
    items: Omit<OrderItem, 'id' | 'order_id'>[]
  ) => {
    // Build order data, including optional custom created_at for backdated orders
    const orderToInsert = {
      ...order,
      created_at: order.created_at || new Date().toISOString(),
    };

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(orderToInsert)
      .select()
      .single();
    
    if (orderError || !orderData) {
      handleError(orderError || new Error('Failed to create order'), { context: 'Create Order' });
      return null;
    }

    if (orderError || !orderData) {
      toast.error('Error al crear pedido');
      console.error('Error creating order:', orderError);
      return null;
    }

    // Insert order items
    const itemsWithOrderId = items.map(item => ({
      ...item,
      order_id: orderData.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      handleError(itemsError, { context: 'Create Order Items' });
      // Order was created but items failed - still return order
    }


    // Stock deduction and stock_movements are now handled automatically
    // by the database trigger 'deduct_stock_on_order_item_insert'
    // This ensures stock is ALWAYS deducted regardless of user role/permissions
    console.log('Order items created - stock deduction handled by database trigger');

    
    toast.success('Pedido creado');

    return orderData;
  }, []);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      handleError(error, { context: 'Update Order' });
      return null;
    }

    
    toast.success('Pedido actualizado');
    return data;
  }, []);

  const updateOrderStatus = useCallback(async (
    id: string, 
    status: Order['status'],
    additionalUpdates?: Partial<Order>
  ) => {
    const updates: Partial<Order> = { 
      status,
      ...additionalUpdates,
    };

    if (status === 'delivered') {
      // Delivery completion must always carry a real GPS proof. A recent
      // geofence validation can supply it, or callers can pass the validated
      // coordinates explicitly. Never allow a delivered row without GPS.
      const validatedLocation = getRecentValidatedDeliveryLocation(id);
      if (
        validatedLocation &&
        (updates.delivery_latitude == null || updates.delivery_longitude == null)
      ) {
        updates.delivery_latitude = validatedLocation.driver.lat;
        updates.delivery_longitude = validatedLocation.driver.lng;
        updates.delivery_distance_m = validatedLocation.distance;
      }

      const hasValidGps =
        Number.isFinite(updates.delivery_latitude as number) &&
        Number.isFinite(updates.delivery_longitude as number) &&
        Math.abs(Number(updates.delivery_latitude)) <= 90 &&
        Math.abs(Number(updates.delivery_longitude)) <= 180 &&
        !(Number(updates.delivery_latitude) === 0 && Number(updates.delivery_longitude) === 0);

      if (!hasValidGps) {
        const gpsError = new Error(
          'GPS requerido: confirma la entrega desde Entregas o Ruta dentro de la zona permitida.'
        );
        toast.error('No se puede marcar como entregado sin GPS', {
          description: 'Abre Entregas o Ruta y permite la ubicación. Debes estar a máximo 200 m del cliente.',
        });
        throw gpsError;
      }

      updates.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      handleError(error, { context: 'Update Order Status' });
      return null;
    }

    
    toast.success('Estado actualizado');
    return data;
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    
    if (error) {
      handleError(error, { context: 'Delete Order' });
      return false;
    }

    
    toast.success('Pedido eliminado');
    return true;
  }, []);

  return {
    orders,
    loading,
    error,
    refetch,
    getOrder,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
  };
}

export function useOrdersByStatus(status?: Order['status']) {
  const { data, loading, error, refetch } = useRealtimeQuery<Order>('orders', {
    filter: status ? [{ column: 'status', value: status }] : undefined,
    orderBy: { column: 'created_at', ascending: false },
  });

  return { orders: data, loading, error, refetch };
}