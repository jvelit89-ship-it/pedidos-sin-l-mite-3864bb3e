import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Truck, 
  ChefHat,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderTracking {
  id: string;
  tracking_code: string;
  status: 'pending' | 'preparation' | 'ready' | 'delivery' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  repartidor_first_name: string | null;
  customer_first_name: string;
  has_delivery_address: boolean;
}

const STATUS_CONFIG = {
  pending: { 
    label: 'Pendiente', 
    icon: Clock, 
    color: 'bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]',
    step: 1
  },
  preparation: { 
    label: 'En Preparación', 
    icon: ChefHat, 
    color: 'bg-[hsl(var(--status-preparation-bg))] text-[hsl(var(--status-preparation))]',
    step: 2
  },
  ready: { 
    label: 'Listo para Envío', 
    icon: Package, 
    color: 'bg-[hsl(var(--status-ready-bg))] text-[hsl(var(--status-ready))]',
    step: 3
  },
  delivery: { 
    label: 'En Camino', 
    icon: Truck, 
    color: 'bg-[hsl(var(--status-delivery-bg))] text-[hsl(var(--status-delivery))]',
    step: 4
  },
  delivered: { 
    label: 'Entregado', 
    icon: CheckCircle2, 
    color: 'bg-[hsl(var(--status-delivered-bg))] text-[hsl(var(--status-delivered))]',
    step: 5
  },
  cancelled: { 
    label: 'Cancelado', 
    icon: XCircle, 
    color: 'bg-[hsl(var(--status-cancelled-bg))] text-[hsl(var(--status-cancelled))]',
    step: 0
  },
};

const STEPS = ['pending', 'preparation', 'ready', 'delivery', 'delivered'] as const;

export default function OrderTrackingPage() {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchOrder = useCallback(async () => {
    if (!trackingCode) {
      setError('Código de seguimiento no proporcionado');
      setLoading(false);
      return;
    }

    try {
      // Use secure Edge Function instead of direct database access
      const { data, error: fetchError } = await supabase.functions.invoke('get-order-tracking', {
        body: { tracking_code: trackingCode }
      });

      if (fetchError) {
        console.error('Error fetching order:', fetchError);
        setError('Error al cargar el pedido');
        setOrder(null);
      } else if (data.error) {
        setError(data.error);
        setOrder(null);
      } else {
        setOrder(data as OrderTracking);
        setError(null);
      }
    } catch (e) {
      console.error('Connection error:', e);
      setError('Error de conexión');
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [trackingCode]);

  // Initial fetch
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrder();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchOrder]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Seguimiento de Pedido - ${trackingCode}`,
          text: `Sigue el estado de tu pedido en tiempo real`,
          url,
        });
      } catch (e) {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copiado al portapapeles');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Pedido no encontrado</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'El código de seguimiento no es válido'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Código ingresado: <span className="font-mono font-bold">{trackingCode}</span>
            </p>
            <Link to="/track">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Buscar otro pedido
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[order.status].icon;
  const currentStep = STATUS_CONFIG[order.status].step;
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Seguimiento de Pedido</p>
              <p className="font-mono font-bold text-lg">{order.tracking_code}</p>
            </div>
            <Button 
              variant="secondary" 
              size="icon"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-safe">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <motion.div
                  key={order.status}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`inline-flex p-4 rounded-full ${STATUS_CONFIG[order.status].color} mb-3`}
                >
                  <StatusIcon className="w-8 h-8" />
                </motion.div>
                <h2 className="text-2xl font-bold">{STATUS_CONFIG[order.status].label}</h2>
                {order.repartidor_first_name && order.status === 'delivery' && (
                  <p className="text-muted-foreground mt-1">
                    Repartidor: <span className="font-medium">{order.repartidor_first_name}</span>
                  </p>
                )}
                {isDelivered && order.delivered_at && (
                  <p className="text-muted-foreground mt-1">
                    Entregado el {format(new Date(order.delivered_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </p>
                )}
              </div>

              {/* Progress Steps */}
              {!isCancelled && (
                <div className="relative">
                  <div className="flex justify-between mb-2">
                    {STEPS.map((step, index) => {
                      const stepConfig = STATUS_CONFIG[step];
                      const StepIcon = stepConfig.icon;
                      const isActive = stepConfig.step <= currentStep;
                      const isCurrent = step === order.status;
                      
                      return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: isCurrent ? 1.2 : 1,
                              backgroundColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <StepIcon className="w-4 h-4" />
                          </motion.div>
                          <span className="text-[10px] mt-1 text-center text-muted-foreground max-w-[60px]">
                            {stepConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted -z-0">
                    <motion.div
                      initial={false}
                      animate={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                      className="h-full bg-primary"
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              {isCancelled && (
                <div className="text-center text-destructive">
                  <p>Este pedido ha sido cancelado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Order Details - Minimal info for privacy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalles del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{order.customer_first_name}</p>
                </div>
              </div>

              {order.has_delivery_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Entrega</p>
                    <p className="font-medium">A domicilio</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha del pedido</p>
                  <p className="font-medium">
                    {format(new Date(order.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3"
        >
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => fetchOrder()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </motion.div>

        {/* Last Updated */}
        <p className="text-center text-xs text-muted-foreground">
          Última actualización: {format(lastUpdated, 'HH:mm:ss')}
        </p>

        {/* Link to Portal */}
        <div className="text-center pt-4">
          <Link 
            to="/track"
            className="text-sm text-primary hover:underline"
          >
            Buscar otro pedido
          </Link>
        </div>
      </div>
    </div>
  );
}
