import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePurchases, Purchase, PurchaseItem } from '@/hooks/usePurchases';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  DollarSign, 
  Calendar,
  Eye,
  XCircle,
  Loader2,
  Package,
  TrendingUp,
} from 'lucide-react';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const { settings, formatCurrency } = useSettings();
  const { 
    purchases, 
    loadingPurchases, 
    stats,
    cancelPurchase,
    isCancellingPurchase,
    getPurchaseDetails,
  } = usePurchases();

  const [searchTerm, setSearchTerm] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [purchaseDetail, setPurchaseDetail] = useState<Purchase | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filteredPurchases = purchases.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    return (
      p.supplier?.name.toLowerCase().includes(searchLower) ||
      p.receipt_number.toLowerCase().includes(searchLower) ||
      p.receipt_series?.toLowerCase().includes(searchLower)
    );
  });

  const handleViewDetails = async (purchase: Purchase) => {
    setLoadingDetail(true);
    setDetailDialogOpen(true);
    try {
      const details = await getPurchaseDetails(purchase.id);
      setPurchaseDetail(details);
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCancelClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (selectedPurchase) {
      await cancelPurchase(selectedPurchase.id);
      setCancelDialogOpen(false);
      setSelectedPurchase(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge variant="secondary" className="text-primary">Activa</Badge>;
    }
    return <Badge variant="destructive">Anulada</Badge>;
  };

  const getReceiptTypeLabel = (type: string) => {
    if (type === 'factura') return 'Factura';
    if (type === 'nota_venta') return 'Nota de Venta';
    return 'Boleta';
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compras</h1>
          <p className="text-muted-foreground">Gestión de compras e ingreso de mercadería</p>
        </div>
        <Button onClick={() => navigate('/purchases/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Compra
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Total Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalPurchases || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Monto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalAmount || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Compras del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.monthlyPurchases || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Monto del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats?.monthlyAmount || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <CardTitle className="flex-1">Listado de Compras</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por proveedor o N°..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPurchases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay compras registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>N° Comprobante</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        {format(new Date(purchase.issue_date), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {purchase.supplier?.name || 'Sin proveedor'}
                      </TableCell>
                      <TableCell>{getReceiptTypeLabel(purchase.receipt_type)}</TableCell>
                      <TableCell>
                        {purchase.receipt_series ? `${purchase.receipt_series}-` : ''}
                        {purchase.receipt_number}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(purchase.total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(purchase)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {purchase.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleCancelClick(purchase)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará la compra y revertirá el stock de los productos. 
              Esta operación no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancellingPurchase}
            >
              {isCancellingPurchase ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Anular Compra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Compra</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : purchaseDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{purchaseDetail.supplier?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">
                    {format(new Date(purchaseDetail.issue_date), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Comprobante</p>
                  <p className="font-medium">
                    {getReceiptTypeLabel(purchaseDetail.receipt_type)}{' '}
                    {purchaseDetail.receipt_series ? `${purchaseDetail.receipt_series}-` : ''}
                    {purchaseDetail.receipt_number}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  {getStatusBadge(purchaseDetail.status)}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseDetail.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.product_sku}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-8 pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="font-medium">{formatCurrency(purchaseDetail.subtotal)}</p>
                </div>
                {purchaseDetail.includes_tax && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">IGV (18%)</p>
                    <p className="font-medium">{formatCurrency(purchaseDetail.tax)}</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(purchaseDetail.total)}</p>
                </div>
              </div>

              {purchaseDetail.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Observaciones</p>
                  <p className="text-sm">{purchaseDetail.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
