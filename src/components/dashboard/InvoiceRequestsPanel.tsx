import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInvoiceRequests } from '@/hooks/useInvoiceRequests';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  FileText, 
  MessageCircle, 
  Mail, 
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Upload,
  RefreshCw,
  Paperclip,
  ExternalLink,
  Trash2
} from 'lucide-react';

interface OrderDetails {
  id: string;
  customer_name: string;
  total: number;
  tracking_code: string | null;
}

export function InvoiceRequestsPanel() {
  const { requests, pendingCount, loading, markAsGenerated, markAsSent, refetch } = useInvoiceRequests();
  const { formatCurrency } = useSettings();
  const [selectedRequest, setSelectedRequest] = useState<typeof requests[0] | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequest) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de archivo no permitido', {
        description: 'Solo se permiten archivos PDF, JPG, PNG o WEBP',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Archivo muy grande', {
        description: 'El archivo no debe superar los 10MB',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedRequest.id}-${Date.now()}.${fileExt}`;
      const filePath = `${selectedRequest.company_id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(filePath);

      // Update invoice request with file URL
      const { error: updateError } = await supabase
        .from('invoice_requests')
        .update({ 
          invoice_file_url: publicUrl,
          status: 'generated'
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Refresh the request data
      setSelectedRequest(prev => prev ? { 
        ...prev, 
        invoice_file_url: publicUrl,
        status: 'generated'
      } : null);

      toast.success('Archivo subido correctamente');
      refetch();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir el archivo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = async () => {
    if (!selectedRequest?.invoice_file_url) return;

    setIsUploading(true);
    try {
      // Extract file path from URL
      const urlParts = selectedRequest.invoice_file_url.split('/invoices/');
      if (urlParts.length > 1) {
        const filePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from('invoices').remove([filePath]);
      }

      // Update invoice request
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          invoice_file_url: null,
          status: 'pending'
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      setSelectedRequest(prev => prev ? { 
        ...prev, 
        invoice_file_url: null,
        status: 'pending'
      } : null);

      toast.success('Archivo eliminado');
      refetch();
    } catch (error) {
      console.error('Error removing file:', error);
      toast.error('Error al eliminar el archivo');
    } finally {
      setIsUploading(false);
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
      
      let message = `¡Hola ${selectedRequest.customer_name}! 📄

Tu ${receiptLabel} está lista.

📋 Datos del comprobante:
• ${docLabel}: ${selectedRequest.document_number}
• Total: ${formatCurrency(orderDetails.total)}
${orderDetails.tracking_code ? `• Código de pedido: ${orderDetails.tracking_code}` : ''}`;

      // Add file link if available
      if (selectedRequest.invoice_file_url) {
        message += `

📎 Descarga tu comprobante aquí:
${selectedRequest.invoice_file_url}`;
      }

      message += `

Por favor responde a este mensaje si tienes alguna consulta.

¡Gracias por tu compra! 🙏`;

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Mark as sent
      await markAsSent(selectedRequest.id, 'whatsapp');
      setSelectedRequest(prev => prev ? { ...prev, status: 'sent', sent_via: 'whatsapp', sent_at: new Date().toISOString() } : null);
      refetch();
    } catch (error) {
      console.error('Error sending via WhatsApp:', error);
      toast.error('Error al enviar por WhatsApp');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!selectedRequest || !orderDetails) return;
    
    setIsSending(true);
    try {
      const receiptLabel = selectedRequest.receipt_type === 'factura' ? 'Factura' : 'Boleta';
      const docLabel = selectedRequest.document_type === 'ruc' ? 'RUC' : 'DNI';
      
      let message = `¡Hola ${selectedRequest.customer_name}! 📄

Te reenviamos tu ${receiptLabel}.

📋 Datos del comprobante:
• ${docLabel}: ${selectedRequest.document_number}
• Total: ${formatCurrency(orderDetails.total)}
${orderDetails.tracking_code ? `• Código de pedido: ${orderDetails.tracking_code}` : ''}`;

      if (selectedRequest.invoice_file_url) {
        message += `

📎 Descarga tu comprobante aquí:
${selectedRequest.invoice_file_url}`;
      }

      message += `

Por favor responde a este mensaje si tienes alguna consulta.

¡Gracias por tu preferencia! 🙏`;

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Update sent timestamp
      await supabase
        .from('invoice_requests')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', selectedRequest.id);

      toast.success('Comprobante reenviado');
      refetch();
    } catch (error) {
      console.error('Error resending:', error);
      toast.error('Error al reenviar');
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
      let body = `Estimado/a ${selectedRequest.customer_name},

Adjunto encontrarás tu ${receiptLabel}.

Datos del comprobante:
- ${docLabel}: ${selectedRequest.document_number}
- Total: ${formatCurrency(orderDetails.total)}
${orderDetails.tracking_code ? `- Código de pedido: ${orderDetails.tracking_code}` : ''}`;

      if (selectedRequest.invoice_file_url) {
        body += `

Descarga tu comprobante aquí: ${selectedRequest.invoice_file_url}`;
      }

      body += `

Gracias por tu preferencia.

Saludos cordiales`;

      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');

      // Mark as sent
      await markAsSent(selectedRequest.id, 'email');
      setSelectedRequest(prev => prev ? { ...prev, status: 'sent', sent_via: 'email', sent_at: new Date().toISOString() } : null);
      refetch();
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
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><FileText className="w-3 h-3 mr-1" /> Con archivo</Badge>;
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
                        {request.invoice_file_url && (
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                        )}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Enviar Comprobante
            </DialogTitle>
            <DialogDescription>
              Sube el archivo y envíalo al cliente por WhatsApp o Email
            </DialogDescription>
          </DialogHeader>

          {isLoadingOrder ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : selectedRequest && orderDetails ? (
            <div className="space-y-4">
              {/* Request details */}
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

              {/* File upload section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Archivo del comprobante</Label>
                {selectedRequest.invoice_file_url ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Paperclip className="w-4 h-4 text-green-600" />
                    <span className="flex-1 text-sm text-green-700 truncate">
                      Archivo adjunto
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-blue-600 hover:text-blue-700"
                      onClick={() => window.open(selectedRequest.invoice_file_url!, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                      onClick={handleRemoveFile}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="flex-1"
                    />
                    {isUploading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Formatos permitidos: PDF, JPG, PNG, WEBP (máx. 10MB)
                </p>
              </div>

              {/* Action buttons */}
              {selectedRequest.status === 'sent' ? (
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <CheckCircle className="w-10 h-10 mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Enviado por {selectedRequest.sent_via === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedRequest.sent_at && format(new Date(selectedRequest.sent_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <Button
                    className="w-full gap-2 bg-[#25D366] hover:bg-[#22c35e] text-white"
                    onClick={handleResend}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Reenviar por WhatsApp
                  </Button>
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
