import { useState, useEffect } from 'react';
import { Package, Droplets, ArrowLeft, Loader2, Phone, TrendingDown, Clock, CheckCircle2, XCircle, AlertCircle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DistributorData {
  customer: {
    id: string;
    name: string;
  };
  stats: {
    totalRemaining: number;
    totalUsed: number;
    totalPurchased: number;
    totalPaid: number;
    activePackages: number;
    pendingContainers: number;
  };
  credits: Array<{
    id: string;
    package_name: string;
    total_credits: number;
    remaining_credits: number;
    amount_paid: number;
    purchase_date: string;
    is_active: boolean;
  }>;
  usage: Array<{
    id: string;
    quantity: number;
    created_at: string;
    notes: string | null;
  }>;
  containers: Array<{
    id: string;
    quantity: number;
    status: string;
    notes: string | null;
    created_at: string;
    reviewed_at: string | null;
    review_notes: string | null;
  }>;
}

export default function DistributorPortalPage() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DistributorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form for registering empty containers
  const [containerQuantity, setContainerQuantity] = useState('');
  const [containerNotes, setContainerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  };

  const handleSearch = async () => {
    if (!phone.trim()) {
      toast.error('Ingresa tu número de teléfono');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('get-distributor-data', {
        body: { phone: phone.trim() },
      });

      if (fnError) throw fnError;

      if (response.error) {
        setError(response.error);
        setData(null);
      } else {
        setData(response);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching distributor data:', err);
      setError('Error al conectar con el servidor');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterContainers = async () => {
    const qty = parseInt(containerQuantity);
    if (!qty || qty < 1) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('get-distributor-data', {
        body: {
          phone: phone.trim(),
          action: 'register_empty_containers',
          quantity: qty,
          notes: containerNotes.trim() || null,
        },
      });

      if (fnError) throw fnError;

      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success('Bidones registrados correctamente. Pendiente de aprobación.');
        setContainerQuantity('');
        setContainerNotes('');
        // Refresh data
        handleSearch();
      }
    } catch (err) {
      console.error('Error registering containers:', err);
      toast.error('Error al registrar bidones');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setData(null);
    setPhone('');
    setError(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Rechazado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Login screen
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Portal de Distribuidores</CardTitle>
            <p className="text-muted-foreground mt-2">
              Ingresa tu número de teléfono para acceder a tu cuenta
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="999 999 999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Solo distribuidores registrados pueden acceder
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{data.customer.name}</h1>
            <p className="text-sm text-muted-foreground">Portal de Distribuidor</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{data.stats.totalRemaining}</p>
              <p className="text-xs text-blue-700">Recargas Disponibles</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{data.stats.totalUsed}</p>
              <p className="text-xs text-green-700">Recargas Usadas</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{data.stats.totalPurchased}</p>
              <p className="text-xs text-purple-700">Total Compradas</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{formatCurrency(data.stats.totalPaid)}</p>
              <p className="text-xs text-amber-700">Total Pagado</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending containers alert */}
        {data.stats.pendingContainers > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
            <Clock className="w-5 h-5" />
            <span className="text-sm">
              Tienes <strong>{data.stats.pendingContainers} bidones</strong> pendientes de aprobación
            </span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="register" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="register">Registrar Bidones</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="packages">Paquetes</TabsTrigger>
          </TabsList>

          {/* Register empty containers */}
          <TabsContent value="register" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Registrar Bidones Vacíos
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Registra los bidones vacíos que dejas. El administrador debe aprobar la cantidad.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad de bidones</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="Ej: 10"
                    value={containerQuantity}
                    onChange={(e) => setContainerQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observaciones adicionales..."
                    value={containerNotes}
                    onChange={(e) => setContainerNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleRegisterContainers}
                  disabled={isSubmitting || !containerQuantity}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Registrar Bidones
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Container history */}
            {data.containers.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Mis Registros de Bidones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {data.containers.map((container) => (
                      <div key={container.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{container.quantity} bidones</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(container.created_at), 'PPp', { locale: es })}
                          </p>
                          {container.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{container.notes}</p>
                          )}
                          {container.review_notes && (
                            <p className="text-xs text-amber-600 mt-1">Admin: {container.review_notes}</p>
                          )}
                        </div>
                        {getStatusBadge(container.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Usage history */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historial de Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                {data.usage.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay entregas registradas
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.usage.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">-{u.quantity} recargas</p>
                            {u.notes && (
                              <p className="text-xs text-muted-foreground">{u.notes}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(u.created_at), 'Pp', { locale: es })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credit packages */}
          <TabsContent value="packages" className="mt-4">
            <div className="space-y-4">
              {data.credits.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No tienes paquetes de créditos
                  </CardContent>
                </Card>
              ) : (
                data.credits.map((credit) => (
                  <Card key={credit.id} className={!credit.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{credit.package_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Comprado: {format(new Date(credit.purchase_date), 'PP', { locale: es })}
                          </p>
                        </div>
                        <Badge variant={credit.is_active ? 'default' : 'secondary'}>
                          {credit.is_active ? 'Activo' : 'Agotado'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted rounded">
                          <p className="text-lg font-bold">{credit.remaining_credits}</p>
                          <p className="text-xs text-muted-foreground">Disponibles</p>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <p className="text-lg font-bold">{credit.total_credits - credit.remaining_credits}</p>
                          <p className="text-xs text-muted-foreground">Usadas</p>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <p className="text-lg font-bold">{formatCurrency(credit.amount_paid)}</p>
                          <p className="text-xs text-muted-foreground">Pagado</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(credit.remaining_credits / credit.total_credits) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {Math.round((credit.remaining_credits / credit.total_credits) * 100)}% restante
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
