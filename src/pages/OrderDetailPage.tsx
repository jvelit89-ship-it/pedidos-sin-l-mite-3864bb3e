import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { OrderStatus, ORDER_STATUS_CONFIG, STATUS_CHANGE_PERMISSIONS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useSalesNote } from '@/hooks/useSalesNote';
import { SalesNotePrint } from '@/components/SalesNotePrint';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Calendar,
  Package,
  Truck,
  RefreshCw,
  FileText,
  Loader2,
  Share2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'> & { tracking_code?: string | null };
type OrderItem = Tables<'order_items'>;

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { generateSalesNote, isGenerating, salesNoteHtml, noteNumber, isDialogOpen, closeDialog } = useSalesNote();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrder();
    }
  }, [id]);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (orderError) throw orderError;

      if (orderData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id);

        if (itemsError) throw itemsError;

        setOrder({
          ...orderData,
          items: itemsData || [],
        });
      }
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Error al cargar el pedido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || !user) return;
    
    setIsUpdating(true);
    try {
      const updateData: Partial<Order> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      setOrder(prev => prev ? { ...prev, ...updateData } : null);
      
      toast.success('Estado actualizado', {
        description: `Pedido marcado como "${ORDER_STATUS_CONFIG[newStatus].label}"`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar', {
        description: 'Intenta nuevamente',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    await handleStatusChange('cancelled');
  };

  const handleRegenerateSalesNote = async () => {
    if (!order) return;

    // Extraer DNI/RUC de las notas si existe
    let documentNumber = '';
    let documentType: 'dni' | 'ruc' = 'dni';
    if (order.notes) {
      const dniMatch = order.notes.match(/DNI:\s*(\d{8})/);
      const rucMatch = order.notes.match(/RUC:\s*(\d{11})/);
      if (rucMatch) {
        documentNumber = rucMatch[1];
        documentType = 'ruc';
      } else if (dniMatch) {
        documentNumber = dniMatch[1];
        documentType = 'dni';
      }
    }

    await generateSalesNote({
      order_id: order.id,
      customer_name: order.customer_name,
      customer_ruc: documentNumber || undefined,
      customer_address: order.delivery_address || '',
      order_items: order.items.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      })),
      total: order.total,
      delivery_date: order.delivery_date || undefined,
      notes: order.notes?.replace(/^(DNI|RUC):\s*\d+\s*\|\s*/, '') || undefined,
      vendedor_name: order.vendedor_name || undefined,
      payment_method: 'Contado',
      document_type: documentType,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-lg font-medium text-muted-foreground">Pedido no encontrado</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          Volver
        </Button>
      </div>
    );
  }

  const allowedStatuses = user ? STATUS_CHANGE_PERMISSIONS[user.role] : [];
  const canChangeStatus = allowedStatuses.length > 0 && order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(order.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 ${ORDER_STATUS_CONFIG[order.status].className}`}>
                  <span className="text-lg">{ORDER_STATUS_CONFIG[order.status].icon}</span>
                  {ORDER_STATUS_CONFIG[order.status].label}
                </div>
              </div>
              {canChangeStatus && (
                <Select
                  value={order.status}
                  onValueChange={(value) => handleStatusChange(value as OrderStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-48">
                    {isUpdating ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    <SelectValue placeholder="Cambiar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS_CONFIG)
                      .filter(([key]) => allowedStatuses.includes(key as OrderStatus))
                      .map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Customer Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold">{order.customer_name}</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{order.delivery_address}</span>
            </div>
            {order.delivery_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Entrega: {format(new Date(order.delivery_date), "d 'de' MMMM", { locale: es })}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Products */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Productos ({order.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Assignment Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Asignación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vendedor</span>
              <span className="font-medium">{order.vendedor_name || 'No asignado'}</span>
            </div>
            {order.repartidor_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Repartidor</span>
                <span className="font-medium">{order.repartidor_name}</span>
              </div>
            )}
            {order.delivered_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Entregado</span>
                <span className="font-medium">
                  {format(new Date(order.delivered_at), "d MMM, HH:mm", { locale: es })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Notes */}
      {order.notes && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{order.notes}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Share Tracking Link */}
      {order.tracking_code && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Código de seguimiento</p>
                  <p className="font-mono font-bold text-lg">{order.tracking_code}</p>
                </div>
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    const url = `${window.location.origin}/track/${order.tracking_code}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copiado al portapapeles');
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  onClick={async () => {
                    const url = `${window.location.origin}/track/${order.tracking_code}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `Seguimiento de Pedido - ${order.tracking_code}`,
                          text: `Sigue el estado de tu pedido en tiempo real: ${order.customer_name}`,
                          url,
                        });
                      } catch (e) {
                        // User cancelled
                      }
                    } else {
                      navigator.clipboard.writeText(url);
                      toast.success('Link copiado al portapapeles');
                    }
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Sales Note Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button 
          onClick={handleRegenerateSalesNote} 
          variant="outline" 
          className="w-full gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Descargar Nota de Venta
        </Button>
      </motion.div>

      {/* Actions */}
      {user?.role === 'admin' && order.status !== 'cancelled' && order.status !== 'delivered' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button variant="destructive" className="w-full" onClick={handleCancel}>
            Cancelar Pedido
          </Button>
        </motion.div>
      )}

      {/* Sales Note Print Dialog */}
      <SalesNotePrint 
        html={salesNoteHtml}
        noteNumber={noteNumber}
        open={isDialogOpen}
        onClose={closeDialog}
      />
    </div>
  );
}
