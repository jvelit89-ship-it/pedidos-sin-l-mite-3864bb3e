import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTopCustomers, TopCustomerItem } from '@/hooks/useTopCustomers';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { Loader2, Download, FileSpreadsheet, FileText, Search, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export function TopCustomersReport() {
  const { settings, formatCurrency } = useSettings();
  const { products } = useProducts();
  const { data, loading, fetchTopCustomers } = useTopCustomers();
  
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [productId, setProductId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleFetch = () => {
    fetchTopCustomers({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      productId: productId
    });
  };

  useEffect(() => {
    handleFetch();
  }, []);

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.business_name && item.business_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportToCSV = () => {
    if (data.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = ['Ranking', 'Cliente', 'Nombre Comercial', 'Total Invertido', 'Total Pedidos', 'Total Unidades'];
    const rows = data.map((item, index) => [
      index + 1,
      item.name,
      item.business_name || '',
      item.total_spent.toFixed(2),
      item.total_orders,
      item.total_units
    ]);
    
    const csvContent = [
      `Reporte Top 100 Clientes (${startDate} a ${endDate})`,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `top_100_clientes_${startDate}_${endDate}.csv`;
    link.click();
    toast.success('Reporte exportado correctamente');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Top 100 Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products.filter(p => p.product_type === 'final').map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleFetch} className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Actualizar Reporte
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t pt-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en el top..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={exportToCSV} className="gap-2 flex-1 sm:flex-none">
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Negocio</TableHead>
                  <TableHead className="text-right">Total Invertido</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Pedidos</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Unidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando datos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No se encontraron resultados para el período seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-muted-foreground">
                        #{index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.business_name || '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(item.total_spent)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {item.total_orders}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {item.total_units}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
