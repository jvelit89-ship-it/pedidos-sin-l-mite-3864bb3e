import { useState } from 'react';
import { useCustomerPricing, CustomerProductPrice } from '@/hooks/useCustomerPricing';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, User, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerPricingManagerProps {
  customerId?: string;
}

export function CustomerPricingManager({ customerId }: CustomerPricingManagerProps) {
  const { prices, loading, addPrice, updatePrice, deletePrice, togglePrice } = useCustomerPricing(customerId);
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { formatCurrency } = useSettings();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CustomerProductPrice | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setEditingPrice(null);
    setSelectedCustomerId(customerId || '');
    setSelectedProductId('');
    setUnitPrice('');
    setNotes('');
  };

  const handleOpenDialog = (price?: CustomerProductPrice) => {
    if (price) {
      setEditingPrice(price);
      setSelectedCustomerId(price.customer_id);
      setSelectedProductId(price.product_id);
      setUnitPrice(price.unit_price.toString());
      setNotes(price.notes || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const priceValue = parseFloat(unitPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error('Ingrese un precio válido');
      return;
    }

    if (!selectedProductId) {
      toast.error('Seleccione un producto');
      return;
    }

    if (!selectedCustomerId) {
      toast.error('Seleccione un cliente');
      return;
    }

    if (editingPrice) {
      await updatePrice(editingPrice.id, {
        unit_price: priceValue,
        notes: notes || null,
      });
    } else {
      await addPrice(selectedCustomerId, selectedProductId, priceValue, notes);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este precio especial?')) {
      await deletePrice(id);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await togglePrice(id, isActive);
  };

  // Group prices by customer
  const pricesByCustomer = prices.reduce((acc, price) => {
    const customerId = price.customer_id;
    if (!acc[customerId]) {
      acc[customerId] = [];
    }
    acc[customerId].push(price);
    return acc;
  }, {} as Record<string, CustomerProductPrice[]>);

  const getProductBasePrice = (productId: string) => {
    return products.find(p => p.id === productId)?.price || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Precios por Cliente</h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Precio
        </Button>
      </div>

      {prices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay precios especiales configurados</p>
            <p className="text-sm">Los precios por cliente se aplican automáticamente al crear pedidos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(pricesByCustomer).map(([custId, customerPrices]) => {
            const customer = customerPrices[0]?.customers;
            const customerName = customer?.business_name || customer?.name || 'Cliente';
            
            return (
              <Card key={custId}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {customerName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {customerPrices.map((price) => {
                      const basePrice = getProductBasePrice(price.product_id);
                      const discount = basePrice - price.unit_price;
                      const discountPercent = basePrice > 0 ? ((discount / basePrice) * 100).toFixed(1) : 0;
                      
                      return (
                        <div
                          key={price.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {price.products?.name || 'Producto'}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {price.products?.sku}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm">
                              <span className="text-muted-foreground line-through">
                                {formatCurrency(basePrice)}
                              </span>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(price.unit_price)}
                              </span>
                              {discount > 0 && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  -{discountPercent}%
                                </Badge>
                              )}
                            </div>
                            {price.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{price.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={price.is_active}
                              onCheckedChange={(checked) => handleToggle(price.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(price)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(price.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? 'Editar Precio Especial' : 'Nuevo Precio Especial'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!customerId && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                  disabled={!!editingPrice}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.business_name || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Producto</Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={!!editingPrice}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku}) - {formatCurrency(product.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Precio Especial</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
                required
              />
              {selectedProductId && unitPrice && (
                <p className="text-xs text-muted-foreground">
                  Precio base: {formatCurrency(getProductBasePrice(selectedProductId))}
                  {parseFloat(unitPrice) < getProductBasePrice(selectedProductId) && (
                    <span className="text-green-600 ml-2">
                      (Descuento: {formatCurrency(getProductBasePrice(selectedProductId) - parseFloat(unitPrice))})
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Precio acordado por contrato anual"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPrice ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
