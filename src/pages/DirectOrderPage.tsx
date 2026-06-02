import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Search, Package, User, CheckCircle2, ChevronRight, ChevronLeft, Building2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Vendedor {
  id: string;
  name: string;
}

export default function DirectOrderPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  
  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  
  const [orderSource, setOrderSource] = useState<'vendedor' | 'factory'>('factory');
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!companyId) return;
    
    // Fetch initial data for the company
    async function fetchData() {
      const [prodRes, vendRes] = await Promise.all([
        supabase.from('products').select('id, name, price, stock').eq('company_id', companyId).eq('product_type', 'final'),
        supabase.from('vendedores').select('id, name').eq('company_id', companyId).eq('active', true)
      ]);
      
      if (prodRes.data) setProducts(prodRes.data);
      if (vendRes.data) setVendedores(vendRes.data);
    }
    
    fetchData();
  }, [companyId]);

  const findCustomer = async () => {
    if (!documentNumber) return;
    setLoading(true);
    
    // Check if exists
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('document_id', documentNumber)
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setCustomer(data);
      setStep(2);
    } else {
      // Prompt new customer registration
      setCustomer({ document_id: documentNumber, name: '', phone: '', address: '', company_id: companyId });
      setStep(2);
    }
    setLoading(false);
  };

  const submitOrder = async () => {
    if (!customer || Object.keys(selectedProducts).length === 0) return;
    setLoading(true);

    try {
      // 1. Upsert Customer
      let customerId = customer.id;
      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ ...customer, document_id: documentNumber })
          .select()
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      } else {
        await supabase.from('customers').update(customer).eq('id', customerId);
      }

      // 2. Create Order
      const total = Object.entries(selectedProducts).reduce((acc, [id, qty]) => {
        const p = products.find(prod => prod.id === id);
        return acc + (p?.price || 0) * qty;
      }, 0);

      const { data: order, error: ordErr } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          customer_name: customer.name,
          total,
          status: 'pending',
          order_source: 'online',
          is_factory_direct: orderSource === 'factory',
          vendedor_id: orderSource === 'vendedor' ? selectedVendedorId : null
        })
        .select()
        .single();
        
      if (ordErr) throw ordErr;

      // 3. Create Items
      const items = Object.entries(selectedProducts).map(([id, qty]) => {
        const product = products.find(p => p.id === id)!;
        return {
          order_id: order.id,
          product_id: id,
          product_name: product.name,
          quantity: qty,
          unit_price: product.price,
          total: product.price * qty
        };
      });

      const { error: itemErr } = await supabase.from('order_items').insert(items);
      if (itemErr) throw itemErr;

      toast.success('Pedido registrado con éxito');
      setStep(6);
    } catch (e) {
      console.error('Error submitting order:', e);
      toast.error('Error al registrar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Pedidos Directos</h1>
          <p className="text-muted-foreground">Realiza tu pedido de forma fácil y rápida</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Identificación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button variant={documentType === 'dni' ? 'default' : 'outline'} onClick={() => setDocumentType('dni')}>DNI</Button>
                    <Button variant={documentType === 'ruc' ? 'default' : 'outline'} onClick={() => setDocumentType('ruc')}>RUC</Button>
                  </div>
                  <Input placeholder={documentType.toUpperCase()} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
                  <Button className="w-full" onClick={findCustomer} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : 'Continuar'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && customer && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Tus Datos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input placeholder="Nombre / Razón Social" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} />
                  <Input placeholder="Teléfono" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} />
                  <Input placeholder="Dirección" value={customer.address} onChange={(e) => setCustomer({...customer, address: e.target.value})} />
                  <Button className="w-full" onClick={() => setStep(3)}>Siguiente</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader>
                  <CardTitle>¿Cómo quieres comprar?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={orderSource} onValueChange={(v: any) => setOrderSource(v)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="factory" id="factory" />
                      <Label htmlFor="factory">Directo de Fábrica (Promos Exclusivas)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="vendedor" id="vendedor" />
                      <Label htmlFor="vendedor">A través de un Vendedor</Label>
                    </div>
                  </RadioGroup>
                  {orderSource === 'vendedor' && (
                    <select className="w-full p-2 border rounded" onChange={(e) => setSelectedVendedorId(e.target.value)}>
                      <option value="">Selecciona un vendedor</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                  <Button className="w-full" onClick={() => setStep(4)} disabled={orderSource === 'vendedor' && !selectedVendedorId}>Siguiente</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Selecciona Productos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {products.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 border-b">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-gray-500">S/ {p.price}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedProducts({...selectedProducts, [p.id]: Math.max(0, (selectedProducts[p.id] || 0) - 1)})}>-</Button>
                        <span>{selectedProducts[p.id] || 0}</span>
                        <Button size="sm" variant="outline" onClick={() => setSelectedProducts({...selectedProducts, [p.id]: (selectedProducts[p.id] || 0) + 1})}>+</Button>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full" onClick={() => setStep(5)} disabled={Object.keys(selectedProducts).length === 0}>Revisar Pedido</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader><CardTitle>Confirmar</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p>Estás a punto de enviar tu pedido.</p>
                  <Button className="w-full" onClick={submitOrder} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Pedido'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
          
          {step === 6 && (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center p-8">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold">¡Pedido Enviado!</h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
