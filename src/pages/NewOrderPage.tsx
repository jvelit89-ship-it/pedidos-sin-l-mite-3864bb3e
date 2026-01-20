import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { useTeam } from '@/hooks/useTeam';
import { useOrders } from '@/hooks/useOrders';
import { useSalesNote } from '@/hooks/useSalesNote';
import { useVolumePricing } from '@/hooks/useVolumePricing';
import { useCustomerPricing } from '@/hooks/useCustomerPricing';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SalesNotePrint } from '@/components/SalesNotePrint';
import { 
  ArrowLeft, 
  Plus, 
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  Tag,
  Search,
  User
} from 'lucide-react';

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { customers, loading: loadingCustomers } = useCustomers();
  const { products, loading: loadingProducts, updateProduct } = useProducts();
  const { vendedores, repartidores, loading: loadingTeam } = useTeam();
  const { createOrder } = useOrders();
  const { generateSalesNote, isGenerating, salesNoteHtml, noteNumber, isDialogOpen, closeDialog } = useSalesNote();
  const { rules: volumePricingRules, getApplicablePrice } = useVolumePricing();
  const { prices: customerPrices, getCustomerPrice } = useCustomerPricing();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueryingDocument, setIsQueryingDocument] = useState(false);

  // Auto-assign vendedor if user is a vendedor
  const isVendedorUser = user?.role === 'vendedor';
  const autoVendedorId = isVendedorUser ? user?.vendedorId : null;

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedVendedorId, setSelectedVendedorId] = useState(autoVendedorId || '');
  const [selectedRepartidorId, setSelectedRepartidorId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'ticket' | 'boleta' | 'factura'>('ticket');
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentData, setDocumentData] = useState<{
    nombre: string | null;
    razon_social: string | null;
    direccion: string;
    estado?: string;
    condicion?: string;
    verified: boolean;
  } | null>(null);

  // Document is required only for boleta/factura
  const requiresDocument = receiptType !== 'ticket';

  const isLoading = loadingCustomers || loadingProducts || loadingTeam;
  const availableProducts = products.filter(p => p.stock > 0);
  const activeVendedores = vendedores.filter(v => v.active);
  const activeRepartidores = repartidores.filter(r => r.active);

  const queryDocument = useCallback(async () => {
    const expectedLength = documentType === 'dni' ? 8 : 11;
    if (documentNumber.length !== expectedLength) {
      toast.error(`${documentType.toUpperCase()} inválido`, {
        description: `Debe tener ${expectedLength} dígitos`
      });
      return;
    }

    setIsQueryingDocument(true);
    setDocumentData(null);

    try {
      const { data, error } = await supabase.functions.invoke('query-document', {
        body: {
          document_type: documentType,
          document_number: documentNumber
        }
      });

      if (error) {
        console.error('Error querying document:', error);
        toast.error('Error al consultar documento', {
          description: error.message
        });
        return;
      }

      console.log('Query document response:', data);
      
      if (data?.success && data?.data) {
        const displayName = data.data.razon_social || data.data.nombre || '';
        
        setDocumentData({
          nombre: data.data.nombre,
          razon_social: data.data.razon_social,
          direccion: data.data.direccion || '',
          estado: data.data.estado,
          condicion: data.data.condicion,
          verified: true
        });
        
        // Auto-llenar la dirección si está vacía
        if (data.data.direccion && !deliveryAddress) {
          setDeliveryAddress(data.data.direccion);
        }

        toast.success('Documento verificado', {
          description: `${documentType === 'ruc' ? 'Razón Social' : 'Nombre'}: ${displayName}`
        });
      } else {
        toast.error('Documento no encontrado', {
          description: data?.error || 'No se pudo verificar el documento'
        });
      }
    } catch (error) {
      console.error('Error querying document:', error);
      toast.error('Error al consultar documento');
    } finally {
      setIsQueryingDocument(false);
    }
  }, [documentType, documentNumber, deliveryAddress]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setDeliveryAddress(customer.address || '');
    }
  };

  const handleAddProduct = (productId: string) => {
    const existing = orderItems.find(item => item.productId === productId);
    if (existing) {
      setOrderItems(items =>
        items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setOrderItems([...orderItems, { productId, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setOrderItems(items =>
      items
        .map(item => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as typeof items
    );
  };

  const handleQuantitySet = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    const maxStock = product?.stock || 999;
    
    setOrderItems(items =>
      items
        .map(item => {
          if (item.productId === productId) {
            const qty = Math.max(1, Math.min(newQuantity, maxStock));
            return { ...item, quantity: qty };
          }
          return item;
        })
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(items => items.filter(item => item.productId !== productId));
  };

  // Calculate pricing with customer-specific prices first, then volume discounts
  const getItemPricing = useCallback((productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return { unitPrice: 0, total: 0, appliedRule: null, discount: 0, hasDiscount: false, hasCustomerPrice: false };
    
    // Check for customer-specific price first
    if (selectedCustomerId) {
      const { price: customerPrice, hasCustomPrice, customerPrice: customerPriceData } = getCustomerPrice(
        selectedCustomerId,
        productId,
        product.price,
        customerPrices
      );
      
      if (hasCustomPrice) {
        const discount = product.price - customerPrice;
        return {
          unitPrice: customerPrice,
          total: customerPrice * quantity,
          appliedRule: null,
          discount,
          hasDiscount: discount > 0,
          hasCustomerPrice: true,
          basePrice: product.price,
        };
      }
    }
    
    // Fall back to volume pricing
    const { price, appliedRule, discount } = getApplicablePrice(
      productId,
      quantity,
      product.price,
      volumePricingRules
    );
    
    return {
      unitPrice: price,
      total: price * quantity,
      appliedRule,
      discount,
      hasDiscount: discount > 0,
      hasCustomerPrice: false,
      basePrice: product.price,
    };
  }, [products, volumePricingRules, getApplicablePrice, selectedCustomerId, customerPrices, getCustomerPrice]);

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const { total } = getItemPricing(item.productId, item.quantity);
      return sum + total;
    }, 0);
  };

  // Check if any item has a discount applied (volume or customer-specific)
  const discountInfo = useMemo(() => {
    let hasVolumeDiscount = false;
    let hasCustomerDiscount = false;
    
    for (const item of orderItems) {
      const pricing = getItemPricing(item.productId, item.quantity);
      if (pricing.hasDiscount) {
        if (pricing.hasCustomerPrice) {
          hasCustomerDiscount = true;
        } else {
          hasVolumeDiscount = true;
        }
      }
    }
    
    return { hasVolumeDiscount, hasCustomerDiscount, hasAnyDiscount: hasVolumeDiscount || hasCustomerDiscount };
  }, [orderItems, getItemPricing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomerId || orderItems.length === 0) {
      toast.error('Datos incompletos', {
        description: 'Selecciona un cliente y al menos un producto',
      });
      return;
    }

    if (!selectedVendedorId) {
      toast.error('Vendedor requerido', {
        description: 'Debes seleccionar un vendedor para el pedido',
      });
      return;
    }

    if (!selectedRepartidorId) {
      toast.error('Repartidor requerido', {
        description: 'Debes asignar un repartidor para la entrega',
      });
      return;
    }

    // Validate document only if required (boleta/factura)
    if (requiresDocument) {
      if (!documentNumber) {
        toast.error('Documento requerido', {
          description: `Debes ingresar el ${documentType.toUpperCase()} del cliente para ${receiptType}`,
        });
        return;
      }

      // Validar formato de documento
      if (documentType === 'dni' && documentNumber.length !== 8) {
        toast.error('DNI inválido', {
          description: 'El DNI debe tener 8 dígitos',
        });
        return;
      }

      if (documentType === 'ruc' && documentNumber.length !== 11) {
        toast.error('RUC inválido', {
          description: 'El RUC debe tener 11 dígitos',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId)!;
      
      // Handle special "Venta de Planta" and "Recojo en Planta" options
      const isVentaPlanta = selectedVendedorId === 'venta-planta';
      const isRecojoPlanta = selectedRepartidorId === 'recojo-planta';
      
      const vendedor = isVentaPlanta ? null : vendedores.find(v => v.id === selectedVendedorId);
      const repartidor = isRecojoPlanta ? null : repartidores.find(r => r.id === selectedRepartidorId);

      // Build order items with product details and volume pricing
      const items = orderItems.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const { unitPrice, total } = getItemPricing(item.productId, item.quantity);
        return {
          product_id: item.productId,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          total: total,
        };
      });

      const orderData = await createOrder({
        company_id: customer.company_id,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_latitude: customer.latitude,
        customer_longitude: customer.longitude,
        delivery_address: deliveryAddress,
        total: calculateTotal(),
        status: 'pending',
        vendedor_id: vendedor?.id || null,
        vendedor_name: isVentaPlanta ? 'Venta de Planta' : (vendedor?.name || null),
        repartidor_id: repartidor?.id || null,
        repartidor_name: isRecojoPlanta ? 'Recojo en Planta' : (repartidor?.name || null),
        delivery_date: deliveryDate,
        notes: requiresDocument && documentNumber 
          ? `${receiptType.toUpperCase()} - ${documentType.toUpperCase()}: ${documentNumber}${notes ? ` | ${notes}` : ''}`
          : notes || null,
      }, items);

      if (orderData) {
        // Deduct stock
        for (const item of orderItems) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            await updateProduct(product.id, {
              stock: Math.max(0, product.stock - item.quantity),
            });
          }
        }

        // Create invoice request if boleta/factura was selected
        if (requiresDocument && documentNumber) {
          await supabase.from('invoice_requests').insert({
            order_id: orderData.id,
            company_id: customer.company_id,
            receipt_type: receiptType,
            document_type: documentType,
            document_number: documentNumber,
            customer_name: documentData?.razon_social || documentData?.nombre || customer.name,
            customer_address: documentData?.direccion || deliveryAddress,
          });
        }

        // Generar nota de venta automáticamente
        // Usar razón social o nombre del documento verificado, o el nombre del cliente como fallback
        const customerDisplayName = documentData?.razon_social || documentData?.nombre || customer.name;
        const customerDocAddress = documentData?.direccion || deliveryAddress;

        await generateSalesNote({
          order_id: orderData.id,
          customer_name: customerDisplayName,
          customer_ruc: requiresDocument ? documentNumber : undefined,
          customer_address: customerDocAddress,
          order_items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          total: calculateTotal(),
          delivery_date: deliveryDate,
          notes,
          vendedor_name: isVentaPlanta ? 'Venta de Planta' : vendedor?.name || '',
          payment_method: 'Contado',
          document_type: requiresDocument ? documentType : undefined,
          receipt_type: receiptType,
        });

        toast.success('Pedido creado', {
          description: 'El pedido ha sido registrado correctamente',
        });
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear pedido', {
        description: 'Intenta nuevamente',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-3 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Nuevo Pedido</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Customer Selection */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Popover open={customerComboOpen} onOpenChange={setCustomerComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedCustomerId
                      ? customers.find(c => c.id === selectedCustomerId)?.name || "Seleccionar cliente"
                      : "Seleccionar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        {customers.map(customer => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.business_name || ''} ${customer.phone || ''}`}
                            onSelect={() => {
                              handleCustomerChange(customer.id);
                              setCustomerComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{customer.name}</span>
                              {customer.business_name && (
                                <span className="text-xs text-muted-foreground">{customer.business_name}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Dirección de Entrega *</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Dirección completa"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardContent className="p-3 space-y-3">
              <div className="space-y-2">
                <Label>Agregar Productos *</Label>
                <Select onValueChange={handleAddProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {orderItems.length > 0 && (
                <div className="space-y-2">
                  {orderItems.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (!product) return null;
                    const pricing = getItemPricing(item.productId, item.quantity);
                    
                    return (
                      <div key={item.productId} className="p-2 bg-muted rounded-lg space-y-2">
                        {/* Product name and price - stacked for mobile */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm leading-tight">{product.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {pricing.hasDiscount ? (
                                <>
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatCurrency(pricing.basePrice!)}
                                  </span>
                                  <span className="text-xs font-medium text-green-600">
                                    {formatCurrency(pricing.unitPrice)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(product.price)} c/u
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => handleRemoveProduct(item.productId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Quantity controls and total - inline */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(item.productId, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={product.stock}
                              value={item.quantity}
                              onChange={(e) => handleQuantitySet(item.productId, parseInt(e.target.value) || 1)}
                              className="w-14 h-7 text-center font-semibold text-sm px-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(item.productId, 1)}
                              disabled={item.quantity >= product.stock}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="font-semibold text-sm">
                            {formatCurrency(pricing.total)}
                          </p>
                        </div>
                        
                        {/* Discount badge - customer or volume */}
                        {pricing.hasDiscount && (
                          <div className="flex items-center gap-1">
                            {pricing.hasCustomerPrice ? (
                              <>
                                <User className="w-3 h-3 text-blue-600" />
                                <span className="text-xs text-blue-600">
                                  Precio especial cliente
                                </span>
                              </>
                            ) : (
                              <>
                                <Tag className="w-3 h-3 text-green-600" />
                                <span className="text-xs text-green-600">
                                  Mayorista ({pricing.appliedRule?.min_quantity}+ uds)
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {orderItems.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  {discountInfo.hasCustomerDiscount && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                        Precio especial de cliente aplicado
                      </span>
                    </div>
                  )}
                  {discountInfo.hasVolumeDiscount && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <Tag className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                        Precio especial por compra al por mayor aplicado
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Receipt Type */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="space-y-3">
              <Label>Tipo de Comprobante</Label>
              <RadioGroup
                value={receiptType}
                onValueChange={(value) => {
                  setReceiptType(value as 'ticket' | 'boleta' | 'factura');
                  // Reset document data when changing receipt type
                  if (value === 'ticket') {
                    setDocumentNumber('');
                    setDocumentData(null);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ticket" id="ticket" />
                  <Label htmlFor="ticket" className="font-normal cursor-pointer">Ticket</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="boleta" id="boleta" />
                  <Label htmlFor="boleta" className="font-normal cursor-pointer">Boleta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="factura" id="factura" />
                  <Label htmlFor="factura" className="font-normal cursor-pointer">Factura</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {receiptType === 'ticket' 
                  ? 'Sin documento requerido' 
                  : `Requiere ${receiptType === 'boleta' ? 'DNI o RUC' : 'RUC'} del cliente`}
              </p>
            </div>

            {/* Document fields - only shown for boleta/factura */}
            {requiresDocument && (
              <>
                <div className="space-y-3">
                  <Label>Tipo de Documento *</Label>
                  <RadioGroup
                    value={documentType}
                    onValueChange={(value) => {
                      setDocumentType(value as 'dni' | 'ruc');
                      setDocumentNumber('');
                      setDocumentData(null);
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dni" id="dni" disabled={receiptType === 'factura'} />
                      <Label htmlFor="dni" className={`font-normal cursor-pointer ${receiptType === 'factura' ? 'text-muted-foreground' : ''}`}>
                        DNI
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ruc" id="ruc" />
                      <Label htmlFor="ruc" className="font-normal cursor-pointer">RUC</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>{documentType.toUpperCase()} *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={documentNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const maxLength = documentType === 'dni' ? 8 : 11;
                        setDocumentNumber(value.slice(0, maxLength));
                        setDocumentData(null);
                      }}
                      placeholder={documentType === 'dni' ? '12345678' : '20123456789'}
                      maxLength={documentType === 'dni' ? 8 : 11}
                      className="flex-1"
                      required
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={queryDocument}
                      disabled={isQueryingDocument || documentNumber.length !== (documentType === 'dni' ? 8 : 11)}
                      className="gap-2"
                    >
                      {isQueryingDocument ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Consultar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {documentType === 'dni' ? '8 dígitos' : '11 dígitos'} - Presiona Consultar para verificar
                  </p>
                </div>

                {/* Document verification result */}
                {documentData?.verified && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium text-sm">Documento verificado</span>
                    </div>
                    <div className="text-sm space-y-1">
                      {documentType === 'ruc' && documentData.razon_social && (
                        <p><span className="font-medium">Razón Social:</span> {documentData.razon_social}</p>
                      )}
                      {documentType === 'dni' && documentData.nombre && (
                        <p><span className="font-medium">Nombre:</span> {documentData.nombre}</p>
                      )}
                      {documentData.direccion && (
                        <p><span className="font-medium">Dirección:</span> {documentData.direccion}</p>
                      )}
                      {documentType === 'ruc' && documentData.estado && (
                        <p>
                          <span className="font-medium">Estado:</span>{' '}
                          <span className={documentData.estado === 'ACTIVO' ? 'text-green-600' : 'text-red-600'}>
                            {documentData.estado}
                          </span>
                          {documentData.condicion && (
                            <span className="ml-2">
                              | <span className="font-medium">Condición:</span>{' '}
                              <span className={documentData.condicion === 'HABIDO' ? 'text-green-600' : 'text-orange-600'}>
                                {documentData.condicion}
                              </span>
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Vendedor - auto-assigned and hidden if user is vendedor */}
                {isVendedorUser ? (
                  <div className="space-y-2">
                    <Label>Vendedor *</Label>
                    <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                      <span className="text-sm">{user?.name || 'Vendedor asignado'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El pedido se asigna automáticamente a tu cuenta
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Vendedor *</Label>
                    <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venta-planta">🏭 Venta de Planta</SelectItem>
                        {activeVendedores.map(vendedor => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>
                            {vendedor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Repartidor *</Label>
                  <Select value={selectedRepartidorId} onValueChange={setSelectedRepartidorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar repartidor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recojo-planta">🏭 Recojo en Planta</SelectItem>
                      {activeRepartidores.map(repartidor => (
                        <SelectItem key={repartidor.id} value={repartidor.id}>
                          {repartidor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fecha de Entrega</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales de entrega..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 gap-2"
          disabled={isSubmitting || !selectedCustomerId || orderItems.length === 0 || !selectedVendedorId || !selectedRepartidorId || (requiresDocument && !documentNumber)}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShoppingCart className="w-5 h-5" />
          )}
          Crear Pedido
        </Button>
      </form>

      {/* Sales Note Print Dialog */}
      <SalesNotePrint 
        html={salesNoteHtml}
        noteNumber={noteNumber}
        open={isDialogOpen}
        onClose={() => {
          closeDialog();
          navigate('/orders');
        }}
      />
    </div>
  );
}
