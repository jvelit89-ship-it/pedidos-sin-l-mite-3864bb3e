import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, 
  Search, 
  Package, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Phone, 
  MapPin, 
  ShoppingCart,
  Factory,
  ArrowRight,
  Tag,
  Percent,
  Droplets,
  GlassWater
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

interface Vendedor {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

export default function DirectOrderPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { formatCurrency } = useSettings();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [customerPrices, setCustomerPrices] = useState<any[]>([]);
  
  const [orderSource, setOrderSource] = useState<'vendedor' | 'factory'>('factory');
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let currentCompanyId = companyId;
        
        // If no companyId, get the first one
        if (!currentCompanyId) {
          const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
          if (firstCompany) {
            currentCompanyId = firstCompany.id;
          }
        }

        if (!currentCompanyId) return;

        const [compRes, prodRes, vendRes, rulesRes] = await Promise.all([
          supabase.from('companies').select('id, name').eq('id', currentCompanyId).single(),
          supabase.from('products').select('id, name, price, stock, image_url').eq('company_id', currentCompanyId).eq('product_type', 'final'),
          supabase.from('vendedores').select('id, name').eq('company_id', currentCompanyId).eq('active', true),
          supabase.from('volume_pricing_rules').select('*').eq('company_id', currentCompanyId).eq('is_active', true)
        ]);
        
        if (compRes.data) setCompany(compRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (vendRes.data) setVendedores(vendRes.data);
        if (rulesRes.data) setPricingRules(rulesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    document.title = "Pedidos Online | Agua Santa Maria y Ecohielo";
  }, [companyId]);

  const findCustomerByValue = async (val: string) => {
    if (!val) return;
    if (documentType === 'dni' && val.length !== 8) return;
    if (documentType === 'ruc' && val.length !== 11) return;

    setLoading(true);
    try {
      // 1. First search in our database
      const { data: localCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('document_id', val)
        .maybeSingle();

      if (localCustomer) {
        setCustomer(localCustomer);
        
        // Fetch specific prices for this customer
        const { data: specPrices } = await supabase
          .from('customer_product_prices')
          .select('*')
          .eq('customer_id', localCustomer.id)
          .eq('is_active', true);
        
        if (specPrices) setCustomerPrices(specPrices);
        toast.success('Cliente encontrado');
        setStep(2);
      } else {
        // 2. If not found, query external document service
        toast.info('Buscando datos oficiales...');
        const { data: docData, error: docError } = await supabase.functions.invoke('query-document', {
          body: { document_type: documentType, document_number: val }
        });

        if (!docError && docData?.success) {
          const result = docData.data;
          setCustomer({ 
            document_id: val, 
            name: result.razon_social || result.nombre || '', 
            phone: '', 
            address: result.direccion || '', 
            company_id: companyId,
            customer_type: documentType === 'ruc' ? 'mayorista' : 'minorista'
          });
          toast.success('Datos recuperados automáticamente');
        } else {
          setCustomer({ 
            document_id: val, 
            name: '', 
            phone: '', 
            address: '', 
            company_id: companyId,
            customer_type: documentType === 'ruc' ? 'mayorista' : 'minorista'
          });
        }
        setStep(2);
      }
    } catch (e) {
      console.error('Error finding customer:', e);
      toast.error('Error al buscar cliente');
    } finally {
      setLoading(false);
    }
  };

  const findCustomer = async () => {
    if (!documentNumber) return;
    if (documentType === 'dni' && documentNumber.length !== 8) {
      toast.error('DNI debe tener 8 dígitos');
      return;
    }
    if (documentType === 'ruc' && documentNumber.length !== 11) {
      toast.error('RUC debe tener 11 dígitos');
      return;
    }
    await findCustomerByValue(documentNumber);
  };

  const handleProductQty = (id: string, delta: number) => {
    setSelectedProducts(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const newItems = { ...prev };
      if (next === 0) delete newItems[id];
      else newItems[id] = next;
      return newItems;
    });
  };

  const getProductPrice = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    // 1. Check customer specific price
    const customerPrice = customerPrices.find(cp => cp.product_id === productId);
    if (customerPrice) return customerPrice.unit_price;

    // 2. Check promotional/volume pricing rules
    const currentDay = new Date().getDay();
    const applicableRules = pricingRules
      .filter(r => {
        if (r.product_id !== productId) return false;
        
        // If we are in the online portal, prioritize online exclusive rules
        // or rules that are not specifically for factory sales if that's the case
        // But the user specifically wants these to be "for the online portal"
        
        // If it's a factory order, we check for rules
        // Promotion days check
        const hasPromotionDays = r.promotion_days && r.promotion_days.length > 0;
        if (hasPromotionDays && !r.promotion_days.includes(currentDay)) {
          return false;
        }

        return quantity >= r.min_quantity;
      })
      .sort((a, b) => {
        // Priority 1: Promotion days (more specific)
        const aHasDays = a.promotion_days && a.promotion_days.length > 0;
        const bHasDays = b.promotion_days && b.promotion_days.length > 0;
        if (aHasDays && !bHasDays) return -1;
        if (!aHasDays && bHasDays) return 1;
        
        // Priority 2: Online exclusive
        if (a.is_online_exclusive && !b.is_online_exclusive) return -1;
        if (!a.is_online_exclusive && b.is_online_exclusive) return 1;
        
        // Priority 3: Quantity (higher quantity wins)
        return b.min_quantity - a.min_quantity;
      });

    if (applicableRules.length > 0) {
      return applicableRules[0].unit_price;
    }

    return product.price;
  };

  const totalAmount = Object.entries(selectedProducts).reduce((acc, [id, qty]) => {
    return acc + getProductPrice(id, qty) * qty;
  }, 0);

  const submitOrder = async () => {
    if (!customer || Object.keys(selectedProducts).length === 0) return;
    setLoading(true);

    try {
      // 1. Upsert Customer
      let customerId = customer.id;
      if (!customerId) {
        // Check again if customer was created by another process while user was filling the form
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id')
          .eq('document_id', documentNumber)
          .maybeSingle();
          
        if (existingCust) {
          customerId = existingCust.id;
          await supabase.from('customers').update({
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            // Don't update company_id if it already belongs to one, 
            // but for this order it will use the current companyId
          }).eq('id', customerId);
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert({ ...customer, document_id: documentNumber, company_id: companyId })
            .select()
            .single();
          if (custErr) throw custErr;
          customerId = newCust.id;
        }
      } else {
        await supabase.from('customers').update({
          name: customer.name,
          phone: customer.phone,
          address: customer.address
        }).eq('id', customerId);
      }

      // 2. Create Order
      const { data: order, error: ordErr } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          customer_name: customer.name,
          total: totalAmount,
          status: 'pending',
          order_source: 'online',
          is_factory_direct: orderSource === 'factory',
          vendedor_id: orderSource === 'vendedor' ? selectedVendedorId : null,
          vendedor_name: orderSource === 'vendedor' ? vendedores.find(v => v.id === selectedVendedorId)?.name : 'Directo de Fábrica'
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
          unit_price: getProductPrice(id, qty),
          total: getProductPrice(id, qty) * qty
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

  const steps = [
    { title: 'Identificación', icon: User },
    { title: 'Datos', icon: MapPin },
    { title: 'Canal', icon: Factory },
    { title: 'Productos', icon: Package },
    { title: 'Confirmar', icon: ShoppingCart },
  ];

  if (loading && !company) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-slate-500 font-medium">Cargando portal de pedidos...</p>
      </div>
    </div>
  );

  if (!company) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <Card className="max-w-md w-full text-center p-8 border-none shadow-xl">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Portal no disponible</h2>
        <p className="text-slate-500 mb-6">El enlace de pedidos no es válido o la empresa no está configurada correctamente.</p>
        <Button className="w-full" onClick={() => window.location.href = '/'}>Volver al inicio</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Header con Estilo Mejorado */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-blue-700 text-primary-foreground p-10 shadow-xl relative overflow-hidden">
        {/* Elementos decorativos abstractos */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-black/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-32 bg-white/5 skew-y-6 pointer-events-none" />
        
        <div className="max-w-md mx-auto flex flex-col items-center gap-6 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/20">
            <div className="bg-white p-3 rounded-2xl shadow-inner">
              <ShoppingCart className="w-10 h-10 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
              Agua Santa María y Ecohielo
            </h1>
            <p className="text-blue-100 font-medium mt-2 text-lg opacity-90">
              Bienvenido a tu Tienda Online
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white/20 border-white/30 text-white font-bold py-1.5 px-6 rounded-full backdrop-blur-sm uppercase tracking-widest text-[11px] shadow-lg">
              {company.name}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-5 pb-24">
        {/* Progress Bar */}
        {step < 6 && (
          <div className="flex justify-between mb-8 overflow-x-auto py-2 px-1">
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = step === i + 1;
              const isPast = step > i + 1;
              return (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[70px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isPast ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-slate-400'}`}>{s.title}</span>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Bienvenido</CardTitle>
                  <CardDescription>Ingresa tu documento para comenzar tu pedido</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant={documentType === 'dni' ? 'default' : 'outline'} 
                      onClick={() => setDocumentType('dni')}
                      className="h-12"
                    >DNI</Button>
                    <Button 
                      variant={documentType === 'ruc' ? 'default' : 'outline'} 
                      onClick={() => setDocumentType('ruc')}
                      className="h-12"
                    >RUC</Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Número de {documentType.toUpperCase()}</Label>
                    <div className="relative">
                      <Input 
                        placeholder={`Ej: ${documentType === 'dni' ? '12345678' : '20123456789'}`} 
                        value={documentNumber} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setDocumentNumber(val);
                          if ((documentType === 'dni' && val.length === 8) || (documentType === 'ruc' && val.length === 11)) {
                            // Automatically trigger search when length is reached
                            setTimeout(() => findCustomerByValue(val), 100);
                          }
                        }}
                        className="h-12 text-lg font-mono pl-10"
                        maxLength={documentType === 'dni' ? 8 : 11}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <Button className="w-full h-12 text-lg font-semibold mt-4" onClick={findCustomer} disabled={loading || !documentNumber}>
                    {loading ? <Loader2 className="animate-spin" /> : 'Continuar'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && customer && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Verifica tus Datos</CardTitle>
                  <CardDescription>Asegúrate de que la información de entrega sea correcta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre / Razón Social</Label>
                    <div className="relative">
                      <Input 
                        value={customer.name} 
                        onChange={(e) => setCustomer({...customer, name: e.target.value})} 
                        className="h-12 pl-10"
                        placeholder="Ingresa tu nombre"
                        required
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono de Contacto</Label>
                    <div className="relative">
                      <Input 
                        value={customer.phone} 
                        onChange={(e) => setCustomer({...customer, phone: e.target.value.replace(/\D/g, '')})} 
                        className="h-12 pl-10"
                        placeholder="Ej: 987654321"
                        maxLength={9}
                        required
                      />
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección de Entrega</Label>
                    <div className="relative">
                      <Input 
                        value={customer.address} 
                        onChange={(e) => setCustomer({...customer, address: e.target.value})} 
                        className="h-12 pl-10"
                        placeholder="Av. Las Magnolias 123..."
                        required
                      />
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                    <Button className="flex-[2] h-12" onClick={() => {
                      if (customer.phone && customer.phone.length !== 9) {
                        toast.error('El teléfono debe tener 9 dígitos');
                        return;
                      }
                      setStep(3);
                    }} disabled={!customer.name || !customer.phone || !customer.address}>Siguiente <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Canal de Venta</CardTitle>
                  <CardDescription>Elige cómo prefieres realizar tu pedido</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <RadioGroup value={orderSource} onValueChange={(v: any) => setOrderSource(v)} className="grid gap-4">
                    <Label htmlFor="factory" className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${orderSource === 'factory' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="factory" id="factory" />
                        <div>
                          <p className="font-bold">Directo de Fábrica</p>
                          <p className="text-xs text-muted-foreground">Accede a promos exclusivas</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">OFERTAS</Badge>
                    </Label>
                    
                    <Label htmlFor="vendedor" className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${orderSource === 'vendedor' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="vendedor" id="vendedor" />
                        <div>
                          <p className="font-bold">A través de un Vendedor</p>
                          <p className="text-xs text-muted-foreground">Asignar a un asesor comercial</p>
                        </div>
                      </div>
                      {orderSource === 'vendedor' && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                          <select 
                            className="w-full h-10 px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-primary" 
                            onChange={(e) => setSelectedVendedorId(e.target.value)}
                            value={selectedVendedorId}
                          >
                            <option value="">Selecciona tu vendedor</option>
                            {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </div>
                      )}
                    </Label>
                  </RadioGroup>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                    <Button className="flex-[2] h-12" onClick={() => setStep(4)} disabled={orderSource === 'vendedor' && !selectedVendedorId}>
                      Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-lg font-bold">Catálogo de Productos</h2>
                  <Badge variant="outline" className="bg-white">{products.length} productos</Badge>
                </div>
                {products.map((p, i) => {
                  const qty = selectedProducts[p.id] || 0;
                  const currentPrice = getProductPrice(p.id, qty || 1);
                  const hasDiscount = currentPrice < p.price;
                  
                  return (
                    <motion.div 
                      key={p.id} 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="border-none shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 group rounded-2xl bg-white flex flex-col">
                        <CardContent className="p-0 flex flex-col flex-1">
                          <div className="flex items-stretch gap-0 h-full">
                            {/* Imagen del Producto o Icono Representativo */}
                            <div className="w-[110px] sm:w-1/3 bg-slate-100 flex items-center justify-center p-2 relative overflow-hidden min-h-[140px] shrink-0">
                              {p.name.toLowerCase().includes('hielo') ? (
                                <div className="flex flex-col items-center gap-2 text-blue-400">
                                  <div className="p-4 bg-blue-50 rounded-2xl shadow-inner">
                                    <Package className="w-12 h-12" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Hielo</span>
                                </div>
                              ) : p.name.toLowerCase().includes('bidon') ? (
                                <div className="flex flex-col items-center gap-2 text-primary">
                                  <div className="p-4 bg-primary/5 rounded-2xl shadow-inner">
                                    <Droplets className="w-12 h-12" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Bidón 20L</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-blue-500">
                                  <div className="p-4 bg-blue-50 rounded-2xl shadow-inner">
                                    <GlassWater className="w-12 h-12" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Botella</span>
                                </div>
                              )}
                              
                              {hasDiscount && (
                                <div className="absolute top-2 left-2 z-10">
                                  <Badge className="bg-green-500 hover:bg-green-600 border-none text-[10px] font-black shadow-md px-2 py-0.5">
                                    -{Math.round(((p.price - currentPrice) / p.price) * 100)}%
                                  </Badge>
                                </div>
                              )}
                            </div>

                            {/* Info del Producto */}
                            <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                              <div>
                                <h3 className="font-bold text-slate-800 text-base sm:text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
                                  {p.name}
                                </h3>
                                <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                                  <p className="text-primary font-black text-lg sm:text-xl whitespace-nowrap">
                                    S/ {Number(currentPrice).toFixed(2)}
                                  </p>
                                  {hasDiscount && (
                                    <p className="text-[11px] sm:text-sm text-slate-400 line-through decoration-slate-300 whitespace-nowrap">
                                      S/ {Number(p.price).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 sm:gap-3 bg-slate-100 rounded-2xl border border-slate-200 p-0.5 sm:p-1 shadow-inner shrink-0">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl hover:bg-white hover:text-primary transition-all active:scale-95"
                                    onClick={() => handleProductQty(p.id, -1)}
                                  >
                                    -
                                  </Button>
                                  <span className="w-4 sm:w-6 text-center font-black text-sm sm:text-base text-slate-700">{selectedProducts[p.id] || 0}</span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl hover:bg-white hover:text-primary transition-all active:scale-95"
                                    onClick={() => handleProductQty(p.id, 1)}
                                  >
                                    +
                                  </Button>
                                </div>

                                {qty > 0 && (
                                  <Badge variant="outline" className="border-primary/30 text-primary font-bold bg-primary/5 text-[10px] sm:text-xs whitespace-nowrap px-1.5 sm:px-2.5">
                                    S/ {(currentPrice * qty).toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
                
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t z-50">
                  <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Total estimado</span>
                      <span className="text-xl font-black text-primary">S/ {totalAmount.toFixed(2)}</span>
                    </div>
                    <Button 
                      className="h-12 px-8 rounded-full text-lg shadow-lg" 
                      onClick={() => setStep(5)} 
                      disabled={Object.keys(selectedProducts).length === 0}
                    >
                      Continuar <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Resumen del Pedido</CardTitle>
                  <CardDescription>Confirma los detalles antes de finalizar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Cliente</span>
                      <span className="font-bold">{customer.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Documento</span>
                      <span className="font-bold">{documentType.toUpperCase()} {documentNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Dirección</span>
                      <span className="font-bold text-right ml-4">{customer.address}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Canal</span>
                      <Badge variant="outline">{orderSource === 'factory' ? 'Directo de Fábrica' : `Vendedor: ${vendedores.find(v => v.id === selectedVendedorId)?.name}`}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-bold px-1">Productos</p>
                    {Object.entries(selectedProducts).map(([id, qty]) => {
                      const p = products.find(prod => prod.id === id);
                      const price = getProductPrice(id, qty);
                      return (
                        <div key={id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 px-1">
                          <span>{qty}x {p?.name}</span>
                          <span className="font-medium">S/ {(price * qty).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-2 px-1">
                    <span className="text-lg font-bold">Total a Pagar</span>
                    <span className="text-2xl font-black text-primary">S/ {totalAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(4)} disabled={loading}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button>
                    <Button className="flex-[2] h-12 text-lg font-bold shadow-lg" onClick={submitOrder} disabled={loading}>
                      {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Pedido'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          
          {step === 6 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center p-8 bg-white rounded-3xl shadow-xl mt-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">¡Pedido Recibido!</h2>
              <p className="text-slate-500 mb-8">Gracias por tu confianza. Estamos procesando tu pedido y te contactaremos pronto.</p>
              <Button className="w-full h-12 rounded-xl" onClick={() => window.location.reload()}>Realizar otro pedido</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
