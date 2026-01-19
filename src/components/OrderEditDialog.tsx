import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Badge } from '@/components/ui/badge';
import { useTeam } from '@/hooks/useTeam';
import { useProducts } from '@/hooks/useProducts';
import { useVolumePricing } from '@/hooks/useVolumePricing';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Minus, Trash2, Package, Tag } from 'lucide-react';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    company_id: string;
    delivery_address: string | null;
    delivery_date: string | null;
    notes: string | null;
    repartidor_id: string | null;
    repartidor_name: string | null;
    items: OrderItem[];
  };
  onSuccess: () => void;
}

export function OrderEditDialog({ open, onOpenChange, order, onSuccess }: OrderEditDialogProps) {
  const { repartidores, loading: loadingTeam } = useTeam();
  const { products, loading: loadingProducts } = useProducts();
  const { rules: volumePricingRules, getApplicablePrice } = useVolumePricing();
  const { formatCurrency } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [deliveryAddress, setDeliveryAddress] = useState(order.delivery_address || '');
  const [deliveryDate, setDeliveryDate] = useState(order.delivery_date || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [selectedRepartidorId, setSelectedRepartidorId] = useState(order.repartidor_id || '');
  
  // Product editing state
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; originalQty: number }[]>([]);

  const activeRepartidores = repartidores.filter(r => r.active);
  const availableProducts = products.filter(p => p.stock > 0 || orderItems.some(item => item.productId === p.id));

  // Initialize items when dialog opens
  useEffect(() => {
    if (open) {
      setDeliveryAddress(order.delivery_address || '');
      setDeliveryDate(order.delivery_date || '');
      setNotes(order.notes || '');
      setSelectedRepartidorId(order.repartidor_id || '');
      setOrderItems(order.items.map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        originalQty: item.quantity,
      })));
    }
  }, [open, order]);

  // Calculate pricing with volume discounts
  const getItemPricing = useCallback((productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return { unitPrice: 0, total: 0, appliedRule: null, discount: 0, hasDiscount: false };
    
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
      basePrice: product.price,
    };
  }, [products, volumePricingRules, getApplicablePrice]);

  const calculateTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const { total } = getItemPricing(item.productId, item.quantity);
      return sum + total;
    }, 0);
  }, [orderItems, getItemPricing]);

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
      setOrderItems([...orderItems, { productId, quantity: 1, originalQty: 0 }]);
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

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(items => items.filter(item => item.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRepartidorId) {
      toast.error('Repartidor requerido', {
        description: 'Debes asignar un repartidor para la entrega',
      });
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Productos requeridos', {
        description: 'El pedido debe tener al menos un producto',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const repartidor = repartidores.find(r => r.id === selectedRepartidorId);
      
      // Update order details
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          delivery_address: deliveryAddress,
          delivery_date: deliveryDate || null,
          notes: notes || null,
          repartidor_id: selectedRepartidorId,
          repartidor_name: repartidor?.name || null,
          total: calculateTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Delete existing order items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      if (deleteError) throw deleteError;

      // Insert new order items
      const newItems = orderItems.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const { unitPrice, total } = getItemPricing(item.productId, item.quantity);
        return {
          order_id: order.id,
          product_id: item.productId,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          total: total,
        };
      });

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(newItems);

      if (insertError) throw insertError;

      // Adjust stock based on quantity changes
      for (const item of orderItems) {
        const originalItem = order.items.find(i => i.product_id === item.productId);
        const originalQty = originalItem?.quantity || 0;
        const qtyDiff = item.quantity - originalQty;

        if (qtyDiff !== 0) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            // Update product stock
            await supabase
              .from('products')
              .update({ stock: Math.max(0, product.stock - qtyDiff) })
              .eq('id', item.productId);

            // Create stock movement
            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.productId,
                company_id: order.company_id,
                movement_type: qtyDiff > 0 ? 'sale' : 'adjustment',
                quantity: -qtyDiff,
                reference_id: order.id,
                notes: `Ajuste por edición de pedido`,
              });
          }
        }
      }

      // Handle removed products - restore stock
      for (const originalItem of order.items) {
        const stillExists = orderItems.some(item => item.productId === originalItem.product_id);
        if (!stillExists) {
          const product = products.find(p => p.id === originalItem.product_id);
          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock + originalItem.quantity })
              .eq('id', originalItem.product_id);

            await supabase
              .from('stock_movements')
              .insert({
                product_id: originalItem.product_id,
                company_id: order.company_id,
                movement_type: 'adjustment',
                quantity: originalItem.quantity,
                reference_id: order.id,
                notes: `Producto removido de pedido`,
              });
          }
        }
      }

      toast.success('Pedido actualizado');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = loadingTeam || loadingProducts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4 pb-2">
            {/* Products Section */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Productos
              </Label>
              
              <Select onValueChange={handleAddProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Agregar producto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {orderItems.length > 0 && (
                <div className="space-y-2 mt-2">
                  {orderItems.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (!product) return null;
                    const pricing = getItemPricing(item.productId, item.quantity);
                    
                    return (
                      <div key={item.productId} className="p-2 bg-muted rounded-lg space-y-2">
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
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                    <Tag className="w-2 h-2 mr-0.5" />
                                    Mayorista
                                  </Badge>
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
                            <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(item.productId, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm">{formatCurrency(pricing.total)}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(calculateTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Dirección de Entrega</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Dirección completa"
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha de Entrega</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Repartidor *</Label>
              <Select value={selectedRepartidorId} onValueChange={setSelectedRepartidorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignar repartidor" />
                </SelectTrigger>
                <SelectContent>
                  {activeRepartidores.map(repartidor => (
                    <SelectItem key={repartidor.id} value={repartidor.id}>
                      {repartidor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales de entrega..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Fixed footer with buttons */}
        <div className="shrink-0 border-t bg-background p-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={isSubmitting || isLoading || orderItems.length === 0}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
