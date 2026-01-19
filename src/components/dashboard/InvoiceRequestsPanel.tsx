import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInvoiceRequests } from '@/hooks/useInvoiceRequests';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FileText, 
  Send, 
  MessageCircle, 
  Mail, 
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface OrderDetails {
  id: string;
  customer_name: string;
  total: number;
  tracking_code: string | null;
}

export function InvoiceRequestsPanel() {
  const { requests, pendingCount, loading, markAsGenerated, markAsSent } = useInvoiceRequests();
  const { formatCurrency } = useSettings();
  const [selectedRequest, setSelectedRequest] = useState<typeof requests[0] | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleOpenRequest = async (request: typeof requests[0]) => {
    setSelectedRequest(request);
    setIsLoadingOrder(true);
    
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, customer_name, total, tracking_code')
        .eq('id', request.order_id)
        .single();
      
      setOrderDetails(data);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const handleSendViaWhatsApp = async () => {
    if (!selectedRequest || !orderDetails) return;
    
    setIsSending(true);
    try {
      // Mark as generated first if not already
      if (selectedRequest.status === 'pending') {
        await markAsGenerated(selectedRequest.id);
      }

      // Create WhatsApp message
      const receiptLabel = selectedRequest.receipt_type === 'factura' ? 'Factura' : 'Boleta';
      const docLabel = selectedRequest.document_type === 'ruc' ? 'RUC' : 'DNI';
      
      const message = `¡Hola ${selectedRequest.customer_name}! 📄

Tu ${receiptLabel} está lista.

📋 Datos del comprobante:
• ${docLabel}: ${selectedRequest.document_number}
• Total: ${formatCurrency(orderDetails.total)}
${orderDetails.tracking_code ? `• Código de pedido: ${orderDetails.tracking_code}` : ''}

Por favor responde a este mensaje si tienes alguna consulta.

¡Gracias por tu compra! 🙏`;

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Mark as sent
      await markAsSent(selectedRequest.id, 'whatsapp');
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error sending via WhatsApp:', error);
      toast.error('Error al enviar por WhatsApp');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendViaEmail = async () => {
    if (!selectedRequest || !orderDetails) return;
    
    setIsSending(true);
    try {
      // Mark as generated first if not already
      if (selectedRequest.status === 'pending') {
        await markAsGenerated(selectedRequest.id);
      }

      // Create mailto link
      const receiptLabel = selectedRequest.receipt_type === 'factura' ? 'Factura' : 'Boleta';
      const docLabel = selectedRequest.document_type === 'ruc' ? 'RUC' : 'DNI';
      
      const subject = `${receiptLabel} - Pedido ${orderDetails.tracking_code || orderDetails.id.slice(0, 8)}`;
      const body = `Estimado/a ${selectedRequest.customer_name},

Adjunto encontrarás tu ${receiptLabel}.

Datos del comprobante:
- ${docLabel}: ${selectedRequest.document_number}
- Total: ${formatCurrency(orderDetails.total)}
${orderDetails.tracking_code ? `- Código de pedido: ${orderDetails.tracking_code}` : ''}

Gracias por tu preferencia.

Saludos cordiales`;

      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');

      // Mark as sent
      await markAsSent(selectedRequest.id, 'email');
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error sending via email:', error);
      toast.error('Error al enviar por email');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'generated':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><FileText className="w-3 h-3 mr-1" /> Generado</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Enviado</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Comprobantes Pendientes
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay solicitudes de comprobantes
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {requests.slice(0, 10).map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleOpenRequest(request)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{request.customer_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {request.receipt_type === 'factura' ? 'Factura' : 'Boleta'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.document_type.toUpperCase()}: {request.document_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Enviar Comprobante
            </DialogTitle>
            <DialogDescription>
              Envía el comprobante al cliente por WhatsApp o Email
            </DialogDescription>
          </DialogHeader>

          {isLoadingOrder ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : selectedRequest && orderDetails ? (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{selectedRequest.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  <Badge>{selectedRequest.receipt_type === 'factura' ? 'Factura' : 'Boleta'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{selectedRequest.document_type.toUpperCase()}:</span>
                  <span className="font-mono">{selectedRequest.document_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="font-bold">{formatCurrency(orderDetails.total)}</span>
                </div>
                {selectedRequest.customer_address && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dirección:</span>
                    <span className="text-sm text-right max-w-[200px]">{selectedRequest.customer_address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Fecha:</span>
                  <span className="text-sm">
                    {format(new Date(selectedRequest.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'sent' ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Comprobante enviado por {selectedRequest.sent_via === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRequest.sent_at && format(new Date(selectedRequest.sent_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="gap-2 bg-[#25D366] hover:bg-[#22c35e] text-white"
                    onClick={handleSendViaWhatsApp}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleSendViaEmail}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    Email
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Error al cargar detalles</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
