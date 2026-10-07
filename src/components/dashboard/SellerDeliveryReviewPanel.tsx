import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, CheckCircle2, MessageSquareWarning, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { OrderWithItems } from '@/hooks/useOrders';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SellerDeliveryReviewPanelProps {
  orders: OrderWithItems[];
  onReviewed?: () => void | Promise<void>;
}

type ReviewStatus = 'conforme' | 'observado';

export function SellerDeliveryReviewPanel({
  orders,
  onReviewed,
}: SellerDeliveryReviewPanelProps) {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('conforme');
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sellerOrders = useMemo(() => {
    if (!user?.vendedorId) return [];

    return orders
      .filter(
        (order) =>
          order.vendedor_id === user.vendedorId &&
          order.status === 'delivered',
      )
      .sort((a, b) => {
        const aDate = new Date(a.delivered_at || a.updated_at).getTime();
        const bDate = new Date(b.delivered_at || b.updated_at).getTime();
        return bDate - aDate;
      });
  }, [orders, user?.vendedorId]);

  const pendingReviews = useMemo(
    () => sellerOrders.filter((order) => !order.seller_delivery_reviewed_at),
    [sellerOrders],
  );

  const reviewedToday = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return sellerOrders.filter(
      (order) =>
        order.seller_delivery_reviewed_at &&
        format(new Date(order.seller_delivery_reviewed_at), 'yyyy-MM-dd') === today,
    ).length;
  }, [sellerOrders]);

  const openReview = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setReviewStatus('conforme');
    setObservation('');
  };

  const closeReview = () => {
    if (submitting) return;
    setSelectedOrder(null);
    setReviewStatus('conforme');
    setObservation('');
  };

  const submitReview = async () => {
    if (!selectedOrder) return;

    const cleaned = observation.trim();
    if (reviewStatus === 'observado' && !cleaned) {
      toast.error('Escribe la observación de la entrega antes de guardar.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('seller_review_delivery', {
        p_order_id: selectedOrder.id,
        p_status: reviewStatus,
        p_observation: cleaned || null,
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data?.error || 'No se pudo registrar la revisión');
      }

      toast.success(
        reviewStatus === 'conforme'
          ? 'Entrega validada por el vendedor'
          : 'Observación de entrega registrada',
        {
          description: `${selectedOrder.customer_name} quedó revisado y registrado en auditoría.`,
        },
      );

      setSelectedOrder(null);
      setObservation('');
      setReviewStatus('conforme');
      await onReviewed?.();
    } catch (error: any) {
      console.error('Seller delivery review error:', error);
      const message = String(error?.message || '');

      if (message.includes('NOT_ORDER_SELLER')) {
        toast.error('Solo el vendedor asignado a este pedido puede revisarlo.');
      } else if (message.includes('ORDER_NOT_DELIVERED')) {
        toast.error('El pedido todavía no está marcado como entregado.');
      } else {
        toast.error('No se pudo guardar la revisión', {
          description: message || 'Vuelve a intentarlo.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.vendedorId) return null;

  return (
    <>
      <Card className={pendingReviews.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/30'}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-xl p-2.5 ${pendingReviews.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg">Entregas para validar</h3>
                    {pendingReviews.length > 0 && (
                      <Badge className="bg-amber-600 hover:bg-amber-600">
                        {pendingReviews.length} por revisar
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cuando tu pedido es entregado, aquí puedes dar fe de la entrega y registrar cualquier observación.
                  </p>
                </div>
              </div>

              {reviewedToday > 0 && (
                <Badge variant="outline" className="hidden sm:inline-flex bg-white text-emerald-700 border-emerald-200">
                  {reviewedToday} revisado(s) hoy
                </Badge>
              )}
            </div>

            {pendingReviews.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-white/80 p-4 flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Todo al día</p>
                  <p className="text-muted-foreground">No tienes entregas pendientes de revisión.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingReviews.slice(0, 8).map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold truncate">{order.customer_name}</p>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          ✅ Entregado
                        </Badge>
                        {order.delivery_confirmation_source === 'superadmin_otp' && (
                          <Badge variant="secondary" className="bg-violet-100 text-violet-800">
                            🛡️ Superadmin · OTP
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs sm:text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>{formatCurrency(order.total)}</span>
                        <span>
                          {order.delivered_at
                            ? format(new Date(order.delivered_at), "d MMM · HH:mm", { locale: es })
                            : 'Entrega registrada'}
                        </span>
                        {order.repartidor_name && (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5" />
                            {order.repartidor_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => openReview(order)}
                      className="w-full sm:w-auto gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Dar fe / Observar
                    </Button>
                  </div>
                ))}

                {pendingReviews.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Hay {pendingReviews.length - 8} entrega(s) adicional(es) pendientes de revisión.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar entrega</DialogTitle>
            <DialogDescription>
              {selectedOrder
                ? `Confirma cómo se recibió la entrega de ${selectedOrder.customer_name}. Tu validación quedará en el historial del pedido.`
                : 'Revisa la entrega.'}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold text-right">{selectedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{formatCurrency(selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-muted-foreground">Repartidor</span>
                  <span className="font-semibold text-right">{selectedOrder.repartidor_name || 'Sin asignar'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={reviewStatus === 'conforme' ? 'default' : 'outline'}
                  className={reviewStatus === 'conforme' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => setReviewStatus('conforme')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Conforme
                </Button>
                <Button
                  type="button"
                  variant={reviewStatus === 'observado' ? 'destructive' : 'outline'}
                  onClick={() => setReviewStatus('observado')}
                >
                  <MessageSquareWarning className="h-4 w-4 mr-2" />
                  Con observación
                </Button>
              </div>

              <div>
                <label className="text-sm font-semibold">
                  Observaciones {reviewStatus === 'observado' ? '*' : '(opcional)'}
                </label>
                <Textarea
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                  placeholder={
                    reviewStatus === 'observado'
                      ? 'Ej.: cliente indicó que faltó una bolsa, producto llegó dañado, horario de entrega, etc.'
                      : 'Puedes dejar una nota adicional sobre la entrega.'
                  }
                  className="mt-2 min-h-28"
                  maxLength={1200}
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">
                  {observation.length}/1200
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={closeReview} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  onClick={submitReview}
                  disabled={submitting || (reviewStatus === 'observado' && !observation.trim())}
                  className={reviewStatus === 'conforme' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  {submitting ? 'Guardando...' : 'Registrar validación'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
