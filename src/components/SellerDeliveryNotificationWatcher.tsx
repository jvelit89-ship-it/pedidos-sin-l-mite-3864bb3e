import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function SellerDeliveryNotificationWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const seenOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role !== 'vendedor' || !user.vendedorId) return;

    let mounted = true;

    const remindPendingReviews = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_name, delivered_at, seller_delivery_reviewed_at')
        .eq('vendedor_id', user.vendedorId)
        .eq('status', 'delivered')
        .is('seller_delivery_reviewed_at', null)
        .order('delivered_at', { ascending: false })
        .limit(20);

      if (!mounted || error || !data?.length) return;

      data.forEach((order: any) => seenOrdersRef.current.add(order.id));

      toast.info(
        data.length === 1
          ? 'Tienes 1 entrega por validar'
          : `Tienes ${data.length} entregas por validar`,
        {
          description: 'Revisa las entregas de tus clientes y registra conformidad u observaciones.',
          duration: 9000,
          action: {
            label: 'Revisar',
            onClick: () => navigate('/dashboard'),
          },
        },
      );
    };

    void remindPendingReviews();

    const channel = supabase
      .channel(`seller-delivery-notifications-${user.vendedorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `vendedor_id=eq.${user.vendedorId}`,
        },
        (payload: any) => {
          const next = payload.new;
          const previous = payload.old;

          if (
            next?.status === 'delivered' &&
            previous?.status !== 'delivered' &&
            !seenOrdersRef.current.has(next.id)
          ) {
            seenOrdersRef.current.add(next.id);

            toast.success(`Pedido entregado: ${next.customer_name || 'cliente'}`, {
              description: 'Da fe de la entrega y registra cualquier observación desde tu Dashboard.',
              duration: 12000,
              action: {
                label: 'Revisar',
                onClick: () => navigate('/dashboard'),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [navigate, user?.role, user?.vendedorId]);

  return null;
}
