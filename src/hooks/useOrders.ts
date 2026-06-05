import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';
import { handleError } from '@/lib/error-handler';
import { useAuth } from '@/contexts/AuthContext';
import { OrderStatus } from '@/types';

interface Order {
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
  
  customers?: {
    customer_type: string | null;
    phone: string | null;
  };
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export function useOrders() {
  const { user } = useAuth();
  const { data: orders, loading, error, refetch } = useRealtimeQuery<OrderWithItems>('orders', {
    select: '*, order_items(*), customers(customer_type, phone)',
    filter: user?.companyId ? [{ column: 'company_id', value: user.companyId }] : undefined,
    orderBy: { column: 'created_at', ascending: false },
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


    // Generate 4-digit PIN and insert into separate table
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
    const { error: pinError } = await supabase
      .from('order_delivery_pins')
      .insert({
        order_id: orderData.id,
        pin: deliveryPin
      });

    if (pinError) {
      handleError(pinError, { context: 'Save Delivery PIN', silent: true });
    }


    // Attach pin to the returned data for immediate use (like WhatsApp sharing)
    const orderWithPin = { ...orderData, delivery_pin: deliveryPin };

    
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
    return orderWithPin;
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
