import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVendedores } from '@/hooks/useTeam';
import { useCommissionSettings, useVendorCommissions, useMyCommissions } from '@/hooks/useCommissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Calendar, Users, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface VendedorCommission {
  vendedor_id: string;
  vendedor_name: string;
  commission_rate: number;
  period1_sales: number;
  period1_commission: number;
  period2_sales: number;
  period2_commission: number;
  total_sales: number;
  total_commission: number;
}

export default function CommissionsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { vendedores } = useVendedores();
  const { setCommissionRate, getCommissionRate, loading: settingsLoading } = useCommissionSettings();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [commissions, setCommissions] = useState<VendedorCommission[]>([]);
  const [myCommission, setMyCommission] = useState<any>(null);
  const [editingVendedor, setEditingVendedor] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  const { calculateCommissions } = useVendorCommissions(selectedYear, selectedMonth);
  const { calculateMyCommissions } = useMyCommissions(user?.vendedorId || null, selectedYear, selectedMonth);

  const isAdminOrSuper = isAdmin || isSuperAdmin;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    loadCommissions();
  }, [selectedMonth, selectedYear, settingsLoading]);

  const loadCommissions = async () => {
    setLoadingCommissions(true);
    try {
      if (isAdminOrSuper) {
        const data = await calculateCommissions();
        setCommissions(data);
      } else if (user?.vendedorId) {
        const data = await calculateMyCommissions();
        setMyCommission(data);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoadingCommissions(false);
    }
  };

  const handleSaveRate = async (vendedorId: string) => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('La comisión debe ser entre 0 y 100%');
      return;
    }
    await setCommissionRate(vendedorId, rate);
    setEditingVendedor(null);
    setNewRate('');
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

  const totalCommissions = commissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalSales = commissions.reduce((sum, c) => sum + c.total_sales, 0);

  // Vendedor view
  if (!isAdminOrSuper) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Mis Comisiones
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

        {loadingCommissions ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Cargando...
            </CardContent>
          </Card>
        ) : myCommission ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Comisión</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myCommission.commission_rate}%</div>
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
                  Ventas: {formatCurrency(myCommission.period1_sales)}
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
                  Ventas: {formatCurrency(myCommission.period2_sales)}
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
                <p className="text-xs text-muted-foreground">
                  Ventas: {formatCurrency(myCommission.total_sales)}
                </p>
              </CardContent>
            </Card>
          </div>
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
          Comisiones de Vendedores
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCommissions)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendedores Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendedores?.filter(v => v.active).length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Comisiones del Mes</TabsTrigger>
          <TabsTrigger value="settings">Configurar Tasas</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingCommissions ? (
                <div className="p-8 text-center text-muted-foreground">Cargando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Tasa</TableHead>
                      <TableHead className="text-right">Periodo 1 (1-15)</TableHead>
                      <TableHead className="text-right">Periodo 2 (16-{new Date(selectedYear, selectedMonth, 0).getDate()})</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.vendedor_id}>
                        <TableCell className="font-medium">{c.vendedor_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{c.commission_rate}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(c.period1_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            Ventas: {formatCurrency(c.period1_sales)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(c.period2_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            Ventas: {formatCurrency(c.period2_sales)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-green-600">{formatCurrency(c.total_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(c.total_sales)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {commissions.length === 0 && (
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

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar Tasas de Comisión</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Tasa Actual</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedores?.filter(v => v.active).map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell className="font-medium">{vendedor.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          Activo
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingVendedor === vendedor.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              className="w-20 text-right"
                              placeholder="0"
                              min="0"
                              max="100"
                              step="0.5"
                            />
                            <span>%</span>
                          </div>
                        ) : (
                          <Badge>{getCommissionRate(vendedor.id)}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingVendedor === vendedor.id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSaveRate(vendedor.id)}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingVendedor(null);
                              setNewRate('');
                            }}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingVendedor(vendedor.id);
                              setNewRate(getCommissionRate(vendedor.id).toString());
                            }}
                          >
                            Editar
                          </Button>
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
    </div>
  );
}
