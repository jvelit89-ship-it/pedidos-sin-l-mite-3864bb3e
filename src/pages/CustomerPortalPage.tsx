import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck,
  History,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderSummary {
  id: string;
  tracking_code: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  preparation: Package,
  ready: Package,
  delivery: Truck,
  delivered: CheckCircle2,
  cancelled: Clock,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  preparation: 'En Preparación',
  ready: 'Listo',
  delivery: 'En Camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function CustomerPortalPage() {
  const navigate = useNavigate();
  
  const [trackingCode, setTrackingCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/track/${trackingCode.trim().toUpperCase()}`);
    }
  };

  const handleSearchByPhone = async () => {
    if (!phoneNumber.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      // Use secure Edge Function instead of direct database access
      const { data, error } = await supabase.functions.invoke('get-customer-orders', {
        body: { phone: phoneNumber.trim() }
      });

      if (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } else if (data.error) {
        console.error('API Error:', data.error);
        setOrders([]);
      } else {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error('Error:', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-lg mx-auto text-center">
          <Package className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Portal del Cliente</h1>
          <p className="text-sm opacity-80 mt-1">
            Rastrea tus pedidos y consulta tu historial
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6 -mt-4">
        <Tabs defaultValue="track" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="track" className="gap-2">
              <Search className="w-4 h-4" />
              Rastrear Pedido
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Track Order Tab */}
          <TabsContent value="track" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rastrear Pedido</CardTitle>
                <CardDescription>
                  Ingresa el código de seguimiento que recibiste
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTrackOrder} className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Ej: ABC12345"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                      className="pl-10 font-mono text-lg tracking-wider"
                      maxLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!trackingCode.trim()}>
                    Buscar Pedido
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Recent tracking illustration */}
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm">
                Ingresa tu código de seguimiento para ver<br />el estado de tu pedido en tiempo real
              </p>
            </div>
          </TabsContent>

          {/* Order History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historial de Pedidos</CardTitle>
                <CardDescription>
                  Busca tus pedidos por número de teléfono
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="Número de teléfono"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={handleSearchByPhone} 
                    className="w-full"
                    disabled={!phoneNumber.trim() || loading}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar Historial
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {searched && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        No se encontraron pedidos para este número
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {orders.length} pedido(s) encontrado(s)
                    </p>
                    {orders.map((order, index) => {
                      const StatusIcon = STATUS_ICONS[order.status] || Package;
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Link to={`/track/${order.tracking_code}`}>
                            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-mono text-sm font-medium">
                                      {order.tracking_code}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {STATUS_LABELS[order.status] || order.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {format(new Date(order.created_at), "d MMM yyyy", { locale: es })}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
