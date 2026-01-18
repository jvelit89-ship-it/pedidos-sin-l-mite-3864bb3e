import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  total: number;
  status: 'pending' | 'preparation' | 'ready' | 'delivery' | 'delivered' | 'cancelled';
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
  const { data: orders, loading, error, refetch } = useRealtimeQuery<OrderWithItems>('orders', {
    select: '*, order_items(*)',
    orderBy: { column: 'created_at', ascending: false },
  });

  const getOrder = useCallback(async (id: string): Promise<OrderWithItems | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching order:', error);
      return null;
    }
    
    return data;
  }, []);

  const createOrder = useCallback(async (
    order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'delivered_at'>,
    items: Omit<OrderItem, 'id' | 'order_id'>[]
  ) => {
    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();
    
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
      console.error('Error creating order items:', itemsError);
      // Order was created but items failed - still return order
    }

    // Register stock movements for each item sold (negative quantity)
    for (const item of items) {
      await supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          company_id: order.company_id,
          movement_type: 'sale',
          quantity: -item.quantity, // negative for sales
          reference_id: orderData.id,
          notes: `Venta - Pedido para ${order.customer_name}`,
        });

      // Update product stock
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, product.stock - item.quantity) })
          .eq('id', item.product_id);
      }
    }

    
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
      toast.error('Error al actualizar pedido');
      console.error('Error updating order:', error);
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
      toast.error('Error al actualizar estado');
      console.error('Error updating order status:', error);
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
      toast.error('Error al eliminar pedido');
      console.error('Error deleting order:', error);
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
