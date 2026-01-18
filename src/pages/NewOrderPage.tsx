import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { useTeam } from '@/hooks/useTeam';
import { useOrders } from '@/hooks/useOrders';
import { useSalesNote } from '@/hooks/useSalesNote';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { SalesNotePrint } from '@/components/SalesNotePrint';
import { 
  ArrowLeft, 
  Plus, 
  Minus,
  Trash2,
  ShoppingCart,
  Loader2
} from 'lucide-react';

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { customers, loading: loadingCustomers } = useCustomers();
  const { products, loading: loadingProducts, updateProduct } = useProducts();
  const { repartidores, loading: loadingTeam } = useTeam();
  const { createOrder } = useOrders();
  const { generateSalesNote, isGenerating, salesNoteHtml, noteNumber, isDialogOpen, closeDialog } = useSalesNote();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedRepartidorId, setSelectedRepartidorId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([]);

  const isLoading = loadingCustomers || loadingProducts || loadingTeam;
  const availableProducts = products.filter(p => p.stock > 0);
  const activeRepartidores = repartidores.filter(r => r.active);

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

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(items => items.filter(item => item.productId !== productId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomerId || orderItems.length === 0) {
      toast.error('Datos incompletos', {
        description: 'Selecciona un cliente y al menos un producto',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId)!;
      const repartidor = repartidores.find(r => r.id === selectedRepartidorId);

      // Build order items with product details
      const items = orderItems.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        return {
          product_id: item.productId,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          total: product.price * item.quantity,
        };
      });

      // Note: vendedor_id should reference vendedores table, not auth.users
      // For now, we don't assign vendedor_id since the current user may not be a vendedor
      const orderData = await createOrder({
        company_id: customer.company_id,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_latitude: customer.latitude,
        customer_longitude: customer.longitude,
        delivery_address: deliveryAddress,
        total: calculateTotal(),
        status: 'pending',
        vendedor_id: null,
        vendedor_name: user?.name || null,
        repartidor_id: repartidor?.id || null,
        repartidor_name: repartidor?.name || null,
        delivery_date: deliveryDate,
        notes,
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

        // Generar nota de venta automáticamente
        await generateSalesNote({
          order_id: orderData.id,
          customer_name: customer.name,
          customer_address: deliveryAddress,
          order_items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          total: calculateTotal(),
          delivery_date: deliveryDate,
          notes,
          vendedor_name: user?.name || undefined,
          payment_method: 'Contado'
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
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Nuevo Pedido</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Selection */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </motion.div>

        {/* Products */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4 space-y-4">
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
                    return (
                      <div key={item.productId} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(product.price)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(item.productId, -1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(item.productId, 1)}
                            disabled={item.quantity >= product.stock}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="font-semibold w-20 text-right">
                          {formatCurrency(product.price * item.quantity)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProduct(item.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {orderItems.length > 0 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Assignment */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Repartidor</Label>
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
                  <Label>Fecha de Entrega</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
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
        </motion.div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 gap-2"
          disabled={isSubmitting || !selectedCustomerId || orderItems.length === 0}
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
