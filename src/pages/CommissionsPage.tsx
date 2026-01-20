import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVendedores, useOperarios } from '@/hooks/useTeam';
import { useProductCommissions, useVendorCommissions, useMyCommissions, useOperarioCommissions, useMyOperarioCommissions } from '@/hooks/useCommissions';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, TrendingUp, Calendar, Users, Package, ChevronLeft, ChevronRight, Eye, CalendarDays, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CommissionSummary {
  id: string;
  name: string;
  period1_units: number;
  period1_commission: number;
  period2_units: number;
  period2_commission: number;
  total_units: number;
  total_commission: number;
  details: any[];
}

export default function CommissionsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { vendedores } = useVendedores();
  const { operarios } = useOperarios();
  const { products, setProductCommission, loading: productsLoading } = useProductCommissions();
  const { formatDateLocal } = useSettings();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [vendedorCommissions, setVendedorCommissions] = useState<CommissionSummary[]>([]);
  const [operarioCommissions, setOperarioCommissions] = useState<CommissionSummary[]>([]);
  const [myCommission, setMyCommission] = useState<any>(null);
  const [dailyCommissions, setDailyCommissions] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'vendedor' | 'operario'>('vendedor');
  const [newAmount, setNewAmount] = useState('');
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<CommissionSummary | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [adminTab, setAdminTab] = useState<'vendedores' | 'operarios'>('vendedores');

  const { calculateCommissions: calcVendedorCommissions, loading: calcVendedorLoading } = useVendorCommissions(selectedYear, selectedMonth);
  const { calculateCommissions: calcOperarioCommissions, loading: calcOperarioLoading } = useOperarioCommissions(selectedYear, selectedMonth);
  const { calculateMyCommissions, getDailyCommissions } = useMyCommissions(user?.vendedorId || null, selectedYear, selectedMonth);
  const { calculateMyCommissions: calcMyOperarioCommissions } = useMyOperarioCommissions(user?.operarioId || null, selectedYear, selectedMonth);

  const isAdminOrSuper = isAdmin || isSuperAdmin;
  const isOperario = user?.role === 'operario';
  const isVendedor = user?.role === 'vendedor';

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    loadCommissions();
  }, [selectedMonth, selectedYear]);

  const loadCommissions = async () => {
    setLoadingCommissions(true);
    try {
      if (isAdminOrSuper) {
        const vendedorData = await calcVendedorCommissions();
        setVendedorCommissions(vendedorData.map(v => ({
          id: v.vendedor_id,
          name: v.vendedor_name,
          ...v,
        })));
        
        const operarioData = await calcOperarioCommissions();
        setOperarioCommissions(operarioData.map(o => ({
          id: o.operario_id,
          name: o.operario_name,
          ...o,
        })));
      } else if (isVendedor && user?.vendedorId) {
        const data = await calculateMyCommissions();
        setMyCommission(data);
        const daily = await getDailyCommissions();
        setDailyCommissions(daily);
      } else if (isOperario && user?.operarioId) {
        const data = await calcMyOperarioCommissions();
        setMyCommission(data);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoadingCommissions(false);
    }
  };

  const handleSaveProductCommission = async (productId: string) => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('El monto debe ser mayor o igual a 0');
      return;
    }
    await setProductCommission(productId, amount, editingType);
    setEditingProduct(null);
    setNewAmount('');
    loadCommissions();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  const totalVendedorCommissions = vendedorCommissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalVendedorUnits = vendedorCommissions.reduce((sum, c) => sum + c.total_units, 0);
  const totalOperarioCommissions = operarioCommissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalOperarioUnits = operarioCommissions.reduce((sum, c) => sum + c.total_units, 0);

  // Non-admin view (vendedor or operario)
  if (!isAdminOrSuper) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Mis Comisiones
          </h1>
          {isVendedor && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('monthly')}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Mensual
              </Button>
              <Button
                variant={viewMode === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('daily')}
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Diario
              </Button>
            </div>
          )}
        </div>

        {/* Month selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium min-w-[150px] text-center">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {loadingCommissions ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Cargando...
            </CardContent>
          </Card>
        ) : viewMode === 'monthly' && myCommission ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {isOperario ? 'Unidades Producidas' : 'Unidades Vendidas'}
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{myCommission.total_units}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Periodo 1 (1-15)</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(myCommission.period1_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myCommission.period1_units} unidades
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Periodo 2 (16-{new Date(selectedYear, selectedMonth, 0).getDate()})</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(myCommission.period2_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myCommission.period2_units} unidades
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total del Mes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(myCommission.total_commission)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Details table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalle de Comisiones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>{isOperario ? 'Producción' : 'Cliente'}</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myCommission.details?.slice(0, 20).map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          {format(new Date(d.order_date || d.produced_at), 'dd/MM', { locale: es })}
                        </TableCell>
                        <TableCell className="text-sm">{d.customer_name || 'Producción'}</TableCell>
                        <TableCell className="text-sm">{d.product_name}</TableCell>
                        <TableCell className="text-right">{d.quantity}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(d.total_commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!myCommission.details || myCommission.details.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay comisiones este mes
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : viewMode === 'daily' && isVendedor ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comisiones por Día (últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyCommissions.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">
                        {format(new Date(d.date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">{d.units}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(d.commission)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dailyCommissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No hay comisiones en los últimos 30 días
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No hay datos de comisiones disponibles
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin view
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Comisiones
        </h1>
      </div>

      {/* Month selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[150px] text-center">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Vendedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalVendedorCommissions)}</div>
            <p className="text-xs text-muted-foreground">{totalVendedorUnits} unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Operarios</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalOperarioCommissions)}</div>
            <p className="text-xs text-muted-foreground">{totalOperarioUnits} unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalVendedorCommissions + totalOperarioCommissions)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Personal Activo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(vendedores?.filter(v => v.active).length || 0) + (operarios?.filter(o => o.active).length || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Comisiones del Mes</TabsTrigger>
          <TabsTrigger value="products">Comisión por Producto</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-4 space-y-4">
          {/* Sub-tabs for vendedores/operarios */}
          <div className="flex gap-2">
            <Button
              variant={adminTab === 'vendedores' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAdminTab('vendedores')}
            >
              <Users className="h-4 w-4 mr-1" />
              Vendedores
            </Button>
            <Button
              variant={adminTab === 'operarios' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAdminTab('operarios')}
            >
              <Wrench className="h-4 w-4 mr-1" />
              Operarios
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingCommissions || calcVendedorLoading || calcOperarioLoading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminTab === 'vendedores' ? 'Vendedor' : 'Operario'}</TableHead>
                      <TableHead className="text-right">Periodo 1 (1-15)</TableHead>
                      <TableHead className="text-right">Periodo 2 (16-{new Date(selectedYear, selectedMonth, 0).getDate()})</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(adminTab === 'vendedores' ? vendedorCommissions : operarioCommissions).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(c.period1_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.period1_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(c.period2_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.period2_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-bold ${adminTab === 'vendedores' ? 'text-green-600' : 'text-blue-600'}`}>
                            {formatCurrency(c.total_commission)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.total_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPerson(c)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(adminTab === 'vendedores' ? vendedorCommissions : operarioCommissions).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay datos de comisiones
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comisión por Producto</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define el monto de comisión por unidad para vendedores (ventas) y operarios (producción)
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Comisión Vendedor</TableHead>
                    <TableHead className="text-right">Comisión Operario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">{product.product_name}</TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id && editingType === 'vendedor' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span>S/</span>
                            <Input
                              type="number"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                              className="w-24 text-right"
                              placeholder="0.0000"
                              min="0"
                              step="0.0001"
                            />
                          </div>
                        ) : (
                          <Badge variant={product.commission_amount > 0 ? 'default' : 'outline'}>
                            {formatCurrency(product.commission_amount)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id && editingType === 'operario' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span>S/</span>
                            <Input
                              type="number"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                              className="w-24 text-right"
                              placeholder="0.0000"
                              min="0"
                              step="0.0001"
                            />
                          </div>
                        ) : (
                          <Badge variant={product.operario_commission_amount > 0 ? 'secondary' : 'outline'}>
                            {formatCurrency(product.operario_commission_amount)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSaveProductCommission(product.product_id)}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingProduct(null);
                              setNewAmount('');
                            }}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product.product_id);
                                setEditingType('vendedor');
                                setNewAmount(product.commission_amount.toString());
                              }}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              V
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product.product_id);
                                setEditingType('operario');
                                setNewAmount(product.operario_commission_amount.toString());
                              }}
                            >
                              <Wrench className="h-3 w-3 mr-1" />
                              O
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Details dialog */}
      <Dialog open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalle de Comisiones - {selectedPerson?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>{adminTab === 'vendedores' ? 'Cliente' : 'Producción'}</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Com/U</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPerson?.details.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      {format(new Date(d.order_date || d.produced_at), 'dd/MM', { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm">{d.customer_name || 'Producción'}</TableCell>
                    <TableCell className="text-sm">{d.product_name}</TableCell>
                    <TableCell className="text-right">{d.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(d.commission_per_unit)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${adminTab === 'vendedores' ? 'text-green-600' : 'text-blue-600'}`}>
                      {formatCurrency(d.total_commission)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!selectedPerson?.details || selectedPerson.details.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay detalles disponibles
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
