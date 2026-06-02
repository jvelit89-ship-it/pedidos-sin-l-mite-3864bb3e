import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useProducts, useProductionHistory } from '@/hooks/useProducts';
import { useStockMovements, useStockReports } from '@/hooks/useStockMovements';
import { useProductionRecipes } from '@/hooks/useProductionRecipes';
import { usePendingProduction } from '@/hooks/usePendingProduction';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSalesReports, exportSalesReportToXLS, exportSalesReportToPDF, SalesPeriod } from '@/hooks/useSalesReports';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Package,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Factory,
  History,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
  Trash2,
  Truck,
  ShoppingCart,
  FlaskConical
} from 'lucide-react';
import { VolumePricingManager } from '@/components/VolumePricingManager';
import { CustomerPricingManager } from '@/components/CustomerPricingManager';
import { ProductionRecipesManager } from '@/components/ProductionRecipesManager';
import { DeleteProductionDialog } from '@/components/DeleteProductionDialog';
import { EditProductOTPDialog } from '@/components/EditProductOTPDialog';
import { PendingProductionPanel } from '@/components/PendingProductionPanel';


interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  stock: number;
  reserved_stock: number; // Stock en tránsito (cargado en vehículos pero no entregado)
  min_stock: number;
  stock_critical_level: number;
  price: number;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  product_type: 'final' | 'raw_material';
}

export default function InventoryPage() {
  const { products, loading, addProduct, updateProduct, deleteProduct, refetch: refetchProducts } = useProducts();
  const { history, addProduction, updateProduction, refetch: refetchHistory } = useProductionHistory();
  const { movements, loading: loadingMovements, refetch: refetchMovements } = useStockMovements();
  const { getProductSummary } = useStockReports();
  const { recipes } = useProductionRecipes();
  const { submitForApproval, checkDuplicate, pendingCount, submitting: pendingSubmitting, refetch: refetchPending } = usePendingProduction();
  const { formatCurrency, settings, t } = useSettings();
  const { user, isAdmin } = useAuth();
  const { data: salesReportData, loading: loadingSalesReport, fetchSalesReport } = useSalesReports();
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'final' | 'raw_material'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productionQuantity, setProductionQuantity] = useState(0);
  const [productionNotes, setProductionNotes] = useState('');
  // Legacy stock report (Producción vs Ventas)
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  // Sales report state
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('month');
  const [salesCustomStart, setSalesCustomStart] = useState('');
  const [salesCustomEnd, setSalesCustomEnd] = useState('');
  const [isDeleteProductionOpen, setIsDeleteProductionOpen] = useState(false);
  const [selectedProductionIds, setSelectedProductionIds] = useState<string[]>([]);
  const [isEditOTPDialogOpen, setIsEditOTPDialogOpen] = useState(false);
  const [pendingEditChanges, setPendingEditChanges] = useState<Record<string, any>>({});
  const [editProductionOpen, setEditProductionOpen] = useState(false);
  const [editProductionItem, setEditProductionItem] = useState<any>(null);
  const [editProductionData, setEditProductionData] = useState({
    quantity: 0,
    notes: '',
    produced_at: '',
  });

  const locale = settings.language === 'es' ? es : enUS;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    stock: 0,
    min_stock: 5,
    price: 0,
    notes: '',
    product_type: 'final' as 'final' | 'raw_material',
    image_url: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: '',
      stock: 0,
      min_stock: 5,
      price: 0,
      notes: '',
      product_type: 'final',
      image_url: '',
    });
    setEditingProduct(null);
  };

  const loadSalesReport = () => {
    fetchSalesReport({
      period: salesPeriod,
      startDate: salesCustomStart ? new Date(salesCustomStart) : undefined,
      endDate: salesCustomEnd ? new Date(salesCustomEnd) : undefined,
    });
  };

  useEffect(() => {
    loadSalesReport();
  }, [salesPeriod]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category || '',
        stock: product.stock,
        min_stock: product.min_stock,
        price: product.price,
        notes: product.notes || '',
        product_type: product.product_type || 'final',
        image_url: (product as any).image_url || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      // For editing, require OTP verification
      const changes = {
        name: formData.name,
        sku: formData.sku,
        category: formData.category || null,
        stock: formData.stock,
        min_stock: formData.min_stock,
        price: formData.price,
        notes: formData.notes || null,
        product_type: formData.product_type,
        image_url: formData.image_url || null,
      };
      setPendingEditChanges(changes);
      setIsDialogOpen(false);
      setIsEditOTPDialogOpen(true);
    } else {
      await addProduct({
        name: formData.name,
        sku: formData.sku,
        category: formData.category || null,
        stock: formData.stock,
        min_stock: formData.min_stock,
        price: formData.price,
        notes: formData.notes || null,
        product_type: formData.product_type,
        image_url: formData.image_url || null,
      } as any);
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const handleEditOTPSuccess = async () => {
    await refetchProducts();
    resetForm();
  };

  const handleDeleteProduct = async (product: Product) => {
    if (confirm(settings.language === 'es' 
      ? `¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`
      : `Delete product "${product.name}"? This action cannot be undone.`)) {
      await deleteProduct(product.id);
    }
  };

  const handleProduction = async () => {
    if (!selectedProductId || productionQuantity <= 0) {
      toast.error(settings.language === 'es' ? 'Selecciona un producto y cantidad' : 'Select a product and quantity');
      return;
    }

    // Check for duplicates first (same product, same quantity within 30 seconds)
    const isDuplicate = await checkDuplicate(selectedProductId, productionQuantity);
    if (isDuplicate) {
      toast.error('Registro duplicado detectado. Por favor espera 30 segundos antes de registrar el mismo producto y cantidad.');
      return;
    }
    
    let success = false;
    
    if (isAdmin) {
      // Admins can register directly
      success = await addProduction(selectedProductId, productionQuantity, productionNotes);
    } else if (isOperario) {
      // Operarios must submit for approval
      success = await submitForApproval(selectedProductId, productionQuantity, productionNotes);
    }
    
    if (success) {
      if (isAdmin) {
        await refetchProducts();
        await refetchMovements();
      }
      await refetchPending();
      setIsProductionDialogOpen(false);
      setSelectedProductId('');
      setProductionQuantity(0);
      setProductionNotes('');
    }
  };

  const loadReport = async () => {
    setLoadingReport(true);
    const data = await getProductSummary(reportPeriod);
    setReportData(data || []);
    setLoadingReport(false);
  };

  useEffect(() => {
    loadReport();
  }, [reportPeriod]);

  const getStockStatus = (product: Product) => {
    if (product.stock === 0) return { status: 'out', label: settings.language === 'es' ? 'Agotado' : 'Out of stock', className: 'stock-out' };
    if (product.stock <= product.min_stock) return { status: 'low', label: settings.language === 'es' ? 'Stock bajo' : 'Low stock', className: 'stock-low' };
    return { status: 'normal', label: 'Normal', className: 'stock-normal' };
  };

  const filteredProducts = useMemo(() => products.filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = productTypeFilter === 'all' || p.product_type === productTypeFilter;
    return matchesSearch && matchesType;
  }), [products, searchTerm, productTypeFilter]);

  const finalProducts = useMemo(() => filteredProducts.filter((p: Product) => p.product_type === 'final'), [filteredProducts]);
  const rawMaterialProducts = useMemo(() => filteredProducts.filter((p: Product) => p.product_type === 'raw_material'), [filteredProducts]);

  // Calculate available stock (stock - reserved)
  const getAvailableStock = (product: Product) => Math.max(0, product.stock - (product.reserved_stock || 0));
  
  const stats = {
    total: products.length,
    finalCount: products.filter((p: Product) => p.product_type === 'final').length,
    rawCount: products.filter((p: Product) => p.product_type === 'raw_material').length,
    low: products.filter((p: Product) => p.stock > 0 && p.stock <= p.min_stock).length,
    out: products.filter((p: Product) => p.stock === 0).length,
    inTransit: products.reduce((sum: number, p: Product) => sum + (p.reserved_stock || 0), 0),
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'production':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'sale':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Package className="w-4 h-4 text-primary" />;
    }
  };

  const getMovementLabel = (type: string) => {
    const labels: Record<string, { es: string; en: string }> = {
      production: { es: 'Producción', en: 'Production' },
      sale: { es: 'Venta', en: 'Sale' },
      adjustment: { es: 'Ajuste', en: 'Adjustment' },
    };
    return labels[type]?.[settings.language] || type;
  };

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, { es: string; en: string }> = {
      day: { es: 'Hoy', en: 'Today' },
      week: { es: 'Esta Semana', en: 'This Week' },
      month: { es: 'Este Mes', en: 'This Month' },
      custom: { es: 'Personalizado', en: 'Custom' },
    };
    return labels[period]?.[settings.language] || period;
  };

  const isOperario = user?.role === 'operario';
  const canViewHistory = isAdmin || isOperario;
  const canRegisterProduction = isAdmin || isOperario;

  // Filter products for direct production - only final products, exclude those with recipes
  const directProductionProducts = useMemo(() => {
    const productsWithRecipes = new Set(recipes.map((r: any) => r.output_product_id));
    return products.filter((p: Product) => {
      const isPreforma = p.name.toLowerCase().includes('preforma');
      const hasRecipe = productsWithRecipes.has(p.id);
      const isFinal = p.product_type === 'final';
      return isFinal && !isPreforma && !hasRecipe;
    });
  }, [products, recipes]);

  const handleDeleteProductionHistory = (productionId?: string) => {
    if (productionId) {
      setSelectedProductionIds([productionId]);
    } else {
      // Delete all
      setSelectedProductionIds([]);
    }
    setIsDeleteProductionOpen(true);
  };

  const handleDeleteProductionSuccess = () => {
    refetchHistory();
    refetchProducts();
    refetchMovements();
  };

  // Export to CSV/XLS format
  const exportToCSV = () => {
    if (reportData.length === 0) {
      toast.error(settings.language === 'es' ? 'No hay datos para exportar' : 'No data to export');
      return;
    }

    const headers = ['Producto', 'SKU', 'Producción', 'Ventas', 'Neto'];
    const rows = reportData.map(item => [
      item.productName,
      item.productSku,
      item.produced,
      item.sold,
      item.net
    ]);
    
    const totals = [
      'TOTAL',
      '',
      reportData.reduce((acc, item) => acc + item.produced, 0),
      reportData.reduce((acc, item) => acc + item.sold, 0),
      reportData.reduce((acc, item) => acc + item.net, 0)
    ];
    
    const csvContent = [
      `Reporte de Inventario - ${getPeriodLabel(reportPeriod)}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      totals.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${reportPeriod}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success(settings.language === 'es' ? 'Reporte XLS descargado' : 'XLS report downloaded');
  };

  // Export to PDF (using print functionality)
  const exportToPDF = () => {
    if (reportData.length === 0) {
      toast.error(settings.language === 'es' ? 'No hay datos para exportar' : 'No data to export');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(settings.language === 'es' ? 'Habilita ventanas emergentes' : 'Enable pop-ups');
      return;
    }

    const totalProduced = reportData.reduce((acc, item) => acc + item.produced, 0);
    const totalSold = reportData.reduce((acc, item) => acc + item.sold, 0);
    const totalNet = reportData.reduce((acc, item) => acc + item.net, 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Inventario - ${getPeriodLabel(reportPeriod)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .positive { color: green; }
          .negative { color: red; }
          .total-row { background-color: #f0f0f0; font-weight: bold; }
          .header-info { margin-bottom: 20px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Reporte de Inventario</h1>
        <div class="header-info">
          <p><strong>Período:</strong> ${getPeriodLabel(reportPeriod)}</p>
          <p><strong>Fecha de generación:</strong> ${format(new Date(), 'PPP', { locale })}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Producción</th>
              <th>Ventas</th>
              <th>Neto</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.productSku}</td>
                <td class="positive">+${item.produced}</td>
                <td class="negative">-${item.sold}</td>
                <td class="${item.net >= 0 ? 'positive' : 'negative'}">${item.net >= 0 ? '+' : ''}${item.net}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">TOTAL</td>
              <td class="positive">+${totalProduced}</td>
              <td class="negative">-${totalSold}</td>
              <td class="${totalNet >= 0 ? 'positive' : 'negative'}">${totalNet >= 0 ? '+' : ''}${totalNet}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success(settings.language === 'es' ? 'Reporte PDF generado' : 'PDF report generated');
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.inventory}</h1>
          <p className="text-muted-foreground">{products.length} {settings.language === 'es' ? 'productos' : 'products'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SyncIndicator />
          
          {/* Production Dialog - For Admin and Operario */}
          {canRegisterProduction && (
          <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Factory className="w-4 h-4" />
                <span className="hidden sm:inline">{settings.language === 'es' ? 'Registrar Producción' : 'Register Production'}</span>
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-md"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>
                  {settings.language === 'es' ? 'Registrar Producción' : 'Register Production'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Warning for operarios that requires approval */}
                {isOperario && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                    <div className="flex items-center gap-2 font-medium mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      Requiere aprobación del administrador
                    </div>
                    <p className="text-amber-700 dark:text-amber-300">
                      Tu registro será enviado para aprobación. El administrador debe confirmar antes de que se agregue al inventario.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Producto' : 'Product'}</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder={settings.language === 'es' ? 'Seleccionar producto' : 'Select product'} /></SelectTrigger>
                    <SelectContent>
                      {directProductionProducts.map((p: Product) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Cantidad Producida' : 'Quantity Produced'}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={productionQuantity || ''}
                    onChange={(e) => setProductionQuantity(parseInt(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.notes}</Label>
                  <Textarea
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    placeholder={settings.language === 'es' ? 'Notas opcionales...' : 'Optional notes...'}
                    rows={2}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsProductionDialogOpen(false)}>
                    {t.cancel}
                  </Button>
                  <Button className="flex-1" onClick={handleProduction} disabled={pendingSubmitting}>
                    {pendingSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : isOperario ? (
                      'Enviar para Aprobación'
                    ) : (
                      settings.language === 'es' ? 'Registrar' : 'Register'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}

          {/* Product Dialog - Only for Admin */}
          {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{settings.language === 'es' ? 'Nuevo Producto' : 'New Product'}</span>
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-md"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? (settings.language === 'es' ? 'Editar Producto' : 'Edit Product') : (settings.language === 'es' ? 'Nuevo Producto' : 'New Product')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>{t.name} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU / {settings.language === 'es' ? 'Código' : 'Code'} *</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{settings.language === 'es' ? 'Categoría' : 'Category'}</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{settings.language === 'es' ? 'Stock Actual' : 'Current Stock'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.stock || ''}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{settings.language === 'es' ? 'Stock Mínimo' : 'Min Stock'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.min_stock || ''}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{settings.language === 'es' ? 'Precio Unitario' : 'Unit Price'} *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formData.price || ''}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Tipo de Producto *</Label>
                    <Select
                      value={formData.product_type}
                      onValueChange={(v) => setFormData({ ...formData, product_type: v as 'final' | 'raw_material' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">🛒 Producto Final (vendible)</SelectItem>
                        <SelectItem value="raw_material">🧪 Materia Prima (producción)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{settings.language === 'es' ? 'URL de Imagen' : 'Image URL'}</Label>
                    <Input
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{t.notes}</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    {t.cancel}
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingProduct ? t.save : t.create}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : canViewHistory ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="inventory" className="gap-1">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Inventario</span>
          </TabsTrigger>
          {canRegisterProduction && (
            <TabsTrigger value="production" className="gap-1">
              <Factory className="w-4 h-4" />
              <span className="hidden sm:inline">Producción</span>
            </TabsTrigger>
          )}
          {canViewHistory && (
            <TabsTrigger value="history" className="gap-1">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="pricing" className="gap-1">
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">Precios</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="sales" className="gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Ventas</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="reports" className="gap-1">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Stock</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Production Tab */}
        {canRegisterProduction && (
          <TabsContent value="production" className="space-y-6">
            <PendingProductionPanel />
            <ProductionRecipesManager onProductionComplete={() => {
              refetchProducts();
              refetchMovements();
            }} />
          </TabsContent>
        )}

        <TabsContent value="inventory" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{stats.finalCount}</p>
                <p className="text-xs text-primary/70">{settings.language === 'es' ? 'Prod. Final' : 'Final Prod.'}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.rawCount}</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">{settings.language === 'es' ? 'Mat. Prima' : 'Raw Mat.'}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.inTransit}</p>
                <p className="text-xs text-orange-600/80 dark:text-orange-400/80">{settings.language === 'es' ? 'En Tránsito' : 'In Transit'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search + Type Filter */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={settings.language === 'es' ? 'Buscar por nombre, SKU o categoría...' : 'Search by name, SKU or category...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={productTypeFilter} onValueChange={(v) => setProductTypeFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="final">Producto Final</SelectItem>
                  <SelectItem value="raw_material">Materia Prima</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Products List - split by type */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">{t.noData}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Final Products */}
              {finalProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-primary">Productos Finales ({finalProducts.length})</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {finalProducts.map((product: Product, index: number) => {
                      const stockInfo = getStockStatus(product);
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <Card className="card-interactive h-full border-primary/20">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-semibold truncate">{product.name}</p>
                                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0">Final</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteProduct(product)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {stockInfo.status === 'out' && <AlertTriangle className="w-4 h-4 stock-out" />}
                                    {stockInfo.status === 'low' && <AlertTriangle className="w-4 h-4 stock-low" />}
                                    {stockInfo.status === 'normal' && <CheckCircle2 className="w-4 h-4 stock-normal" />}
                                    <span className={`text-sm font-medium ${stockInfo.className}`}>
                                      {product.stock} {settings.language === 'es' ? 'uds' : 'units'}
                                    </span>
                                  </div>
                                  {(product.reserved_stock || 0) > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                      <Truck className="w-3 h-3" />
                                      <span>{product.reserved_stock} en tránsito</span>
                                    </div>
                                  )}
                                </div>
                                <p className="font-bold">{formatCurrency(product.price)}</p>
                              </div>
                              {product.category && (
                                <p className="text-xs text-muted-foreground mt-2 px-2 py-1 bg-muted rounded inline-block">
                                  {product.category}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Raw Materials */}
              {rawMaterialProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-amber-600 dark:text-amber-400">Materias Primas ({rawMaterialProducts.length})</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {rawMaterialProducts.map((product: Product, index: number) => {
                      const stockInfo = getStockStatus(product);
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <Card className="card-interactive h-full border-amber-200 dark:border-amber-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-semibold truncate">{product.name}</p>
                                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700 shrink-0">Mat. Prima</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(product)}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteProduct(product)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {stockInfo.status === 'out' && <AlertTriangle className="w-4 h-4 stock-out" />}
                                    {stockInfo.status === 'low' && <AlertTriangle className="w-4 h-4 stock-low" />}
                                    {stockInfo.status === 'normal' && <CheckCircle2 className="w-4 h-4 stock-normal" />}
                                    <span className={`text-sm font-medium ${stockInfo.className}`}>
                                      {product.stock} {settings.language === 'es' ? 'uds' : 'units'}
                                    </span>
                                  </div>
                                </div>
                                <p className="font-bold text-sm text-muted-foreground">SKU: {product.sku}</p>
                              </div>
                              {product.category && (
                                <p className="text-xs text-muted-foreground mt-2 px-2 py-1 bg-muted rounded inline-block">
                                  {product.category}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Production History - Admin can delete individual records */}
          {isAdmin && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Factory className="w-4 h-4" />
                    {settings.language === 'es' ? 'Historial de Producción' : 'Production History'}
                  </h3>
                  {history && history.length > 0 && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-muted-foreground"
                        checked={selectedProductionIds.length === history.length && history.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductionIds(history.map((h: any) => h.id));
                          } else {
                            setSelectedProductionIds([]);
                          }
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {settings.language === 'es' ? 'Sel. todo' : 'Select all'}
                      </span>
                    </div>
                  )}
                </div>
                {history && history.length > 0 && (
                  <div className="flex items-center gap-2">
                    {selectedProductionIds.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {selectedProductionIds.length} {settings.language === 'es' ? 'seleccionados' : 'selected'}
                      </span>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive hover:text-destructive gap-2"
                      onClick={() => {
                        if (selectedProductionIds.length > 0) {
                          // Delete selected items
                          setIsDeleteProductionOpen(true);
                        } else {
                          // Delete all
                          handleDeleteProductionHistory();
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {selectedProductionIds.length > 0 
                          ? (settings.language === 'es' ? `Eliminar (${selectedProductionIds.length})` : `Delete (${selectedProductionIds.length})`)
                          : (settings.language === 'es' ? 'Eliminar Todo' : 'Delete All')
                        }
                      </span>
                    </Button>
                  </div>
                )}
              </div>
              {!history || history.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{settings.language === 'es' ? 'Sin registros de producción' : 'No production records'}</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {history.map((item: any) => (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${selectedProductionIds.includes(item.id) ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-muted-foreground"
                          checked={selectedProductionIds.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProductionIds([...selectedProductionIds, item.id]);
                            } else {
                              setSelectedProductionIds(selectedProductionIds.filter(id => id !== item.id));
                            }
                          }}
                        />
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="font-medium">{item.products?.name || 'Producto'}</p>
                          <p className="text-xs text-muted-foreground">
                            {settings.language === 'es' ? 'Producción' : 'Production'} • {format(new Date(item.produced_at), 'PPp', { locale })}
                          </p>
                          <p className="text-xs text-primary font-medium">
                            {settings.language === 'es' ? 'Registrado por: ' : 'Registered by: '}
                            {item.producer_name || (settings.language === 'es' ? 'Desconocido' : 'Unknown')}
                          </p>
                          {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-600">+{item.quantity}</span>
                          <p className="text-xs text-muted-foreground">{settings.language === 'es' ? 'unidades' : 'units'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditProductionItem(item);
                            setEditProductionData({
                              quantity: item.quantity,
                              notes: item.notes || '',
                              produced_at: item.produced_at.split('T')[0],
                            });
                            setEditProductionOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProductionHistory(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Stock Movements */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">
                {settings.language === 'es' ? 'Historial de Movimientos' : 'Movement History'}
              </h3>
              {loadingMovements ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </div>
              ) : movements.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t.noData}</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {movements.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {getMovementIcon(item.movement_type)}
                        <div>
                          <p className="font-medium">{item.products?.name || 'Producto'}</p>
                          <p className="text-xs text-muted-foreground">
                            {getMovementLabel(item.movement_type)} • {format(new Date(item.created_at), 'PPp', { locale })}
                          </p>
                          {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${item.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.quantity > 0 ? '+' : ''}{item.quantity}
                        </span>
                        <p className="text-xs text-muted-foreground">{settings.language === 'es' ? 'unidades' : 'units'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Report Tab - Admin Only */}
        {isAdmin && (
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Reporte de Ventas por Producto
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline" size="sm"
                    className="gap-1"
                    onClick={() => {
                      if (salesReportData.length === 0) { toast.error('No hay datos para exportar'); return; }
                      exportSalesReportToXLS(salesReportData, getPeriodLabel(salesPeriod), formatCurrency);
                      toast.success('Excel descargado');
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="gap-1"
                    onClick={() => {
                      if (salesReportData.length === 0) { toast.error('No hay datos para exportar'); return; }
                      exportSalesReportToPDF(salesReportData, getPeriodLabel(salesPeriod), formatCurrency);
                      toast.success('PDF generado');
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              </div>

              {/* Period Selector */}
              <div className="flex flex-wrap gap-2">
                {(['day', 'week', 'month', 'custom'] as SalesPeriod[]).map(p => (
                  <Button
                    key={p}
                    size="sm"
                    variant={salesPeriod === p ? 'default' : 'outline'}
                    onClick={() => setSalesPeriod(p)}
                  >
                    {p === 'day' ? 'Hoy' : p === 'week' ? 'Esta Semana' : p === 'month' ? 'Este Mes' : 'Personalizado'}
                  </Button>
                ))}
              </div>

              {/* Custom date range */}
              {salesPeriod === 'custom' && (
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Fecha Inicio</Label>
                    <Input type="date" value={salesCustomStart} onChange={e => setSalesCustomStart(e.target.value)} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Fecha Fin</Label>
                    <Input type="date" value={salesCustomEnd} onChange={e => setSalesCustomEnd(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={loadSalesReport} disabled={loadingSalesReport}>
                    {loadingSalesReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Consultar
                  </Button>
                </div>
              )}

              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">Período: {getPeriodLabel(salesPeriod)} | Solo pedidos entregados</p>
              </div>

              {loadingSalesReport ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </div>
              ) : salesReportData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Sin ventas entregadas en este período</p>
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="hidden sm:grid grid-cols-5 gap-2 p-3 bg-muted rounded-lg font-semibold text-sm">
                    <div className="col-span-2">Producto</div>
                    <div className="text-center">Unidades</div>
                    <div className="text-center">Precio Prom.</div>
                    <div className="text-right">Total Ingresos</div>
                  </div>

                  {salesReportData.map((item, index) => (
                    <motion.div
                      key={item.product_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-card border rounded-lg text-sm"
                    >
                      <div className="col-span-2">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.product_sku}</p>
                      </div>
                      <div className="text-center font-semibold">{item.total_units} uds</div>
                      <div className="text-center text-muted-foreground">{formatCurrency(item.avg_price)}</div>
                      <div className="text-right font-bold text-primary">{formatCurrency(item.total_revenue)}</div>
                    </motion.div>
                  ))}

                  {/* Totals */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-primary/5 border-2 border-primary/20 rounded-lg font-bold text-sm">
                    <div className="col-span-2">TOTAL ({salesReportData.length} productos)</div>
                    <div className="text-center">{salesReportData.reduce((s, i) => s + i.total_units, 0)} uds</div>
                    <div className="text-center">-</div>
                    <div className="text-right text-primary">{formatCurrency(salesReportData.reduce((s, i) => s + i.total_revenue, 0))}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Legacy Inventory Report Tab - Admin Only */}
        {isAdmin && (
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold">
                  {settings.language === 'es' ? 'Reporte de Inventario (Producción vs Ventas)' : 'Inventory Report'}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as 'day' | 'week' | 'month')}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Hoy</SelectItem>
                      <SelectItem value="week">Esta Semana</SelectItem>
                      <SelectItem value="month">Este Mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mb-4 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">Período: {getPeriodLabel(reportPeriod)}</p>
              </div>

              {loadingReport ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
              ) : reportData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Sin movimientos en este período</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-2 p-3 bg-muted rounded-lg font-semibold text-sm">
                    <div className="col-span-2">Producto</div>
                    <div className="text-center">Producción</div>
                    <div className="text-center">Vendido</div>
                    <div className="text-center">Neto</div>
                  </div>
                  {reportData.map((item, index) => (
                    <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
                      className="grid grid-cols-5 gap-2 p-3 bg-card border rounded-lg text-sm">
                      <div className="col-span-2">
                        <p className="font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productSku}</p>
                      </div>
                      <div className="text-center text-green-600 font-semibold">+{item.produced}</div>
                      <div className="text-center text-red-600 font-semibold">-{item.sold}</div>
                      <div className={`text-center font-bold ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.net >= 0 ? '+' : ''}{item.net}
                      </div>
                    </motion.div>
                  ))}
                  <div className="grid grid-cols-5 gap-2 p-3 bg-primary/5 border-2 border-primary/20 rounded-lg font-semibold text-sm">
                    <div className="col-span-2">TOTAL</div>
                    <div className="text-center text-green-600">+{reportData.reduce((acc, item) => acc + item.produced, 0)}</div>
                    <div className="text-center text-red-600">-{reportData.reduce((acc, item) => acc + item.sold, 0)}</div>
                    <div className={`text-center ${reportData.reduce((acc, item) => acc + item.net, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {reportData.reduce((acc, item) => acc + item.net, 0) >= 0 ? '+' : ''}{reportData.reduce((acc, item) => acc + item.net, 0)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Pricing Tab - Admin Only */}
        {isAdmin && (
        <TabsContent value="pricing" className="space-y-4">
          <div className="space-y-6">
            <VolumePricingManager />
            <div className="border-t pt-6">
              <CustomerPricingManager />
            </div>
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* Delete Production Dialog */}
      <DeleteProductionDialog
        open={isDeleteProductionOpen}
        onOpenChange={setIsDeleteProductionOpen}
        productionIds={selectedProductionIds}
        deleteAll={selectedProductionIds.length === 0}
        onSuccess={handleDeleteProductionSuccess}
        language={settings.language as 'es' | 'en'}
      />

      {/* Edit Product OTP Dialog */}
      {editingProduct && (
        <EditProductOTPDialog
          open={isEditOTPDialogOpen}
          onOpenChange={setIsEditOTPDialogOpen}
          productId={editingProduct.id}
          productName={editingProduct.name}
          pendingChanges={pendingEditChanges}
          onSuccess={handleEditOTPSuccess}
        />
      )}

      {/* Edit Production Dialog */}
      <Dialog open={editProductionOpen} onOpenChange={setEditProductionOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {settings.language === 'es' ? 'Editar Registro de Producción' : 'Edit Production Record'}
            </DialogTitle>
          </DialogHeader>
          {editProductionItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{editProductionItem.products?.name || 'Producto'}</p>
                <p className="text-xs text-muted-foreground">
                  {settings.language === 'es' ? 'Registrado por: ' : 'Registered by: '}
                  {editProductionItem.profiles?.name || (settings.language === 'es' ? 'Desconocido' : 'Unknown')}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>{settings.language === 'es' ? 'Cantidad' : 'Quantity'}</Label>
                <Input
                  type="number"
                  value={editProductionData.quantity}
                  onChange={(e) => setEditProductionData({
                    ...editProductionData,
                    quantity: Number(e.target.value)
                  })}
                  min={1}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="space-y-2">
                <Label>{settings.language === 'es' ? 'Fecha de Producción' : 'Production Date'}</Label>
                <Input
                  type="date"
                  value={editProductionData.produced_at}
                  onChange={(e) => setEditProductionData({
                    ...editProductionData,
                    produced_at: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>{settings.language === 'es' ? 'Notas' : 'Notes'}</Label>
                <Textarea
                  value={editProductionData.notes}
                  onChange={(e) => setEditProductionData({
                    ...editProductionData,
                    notes: e.target.value
                  })}
                  placeholder={settings.language === 'es' ? 'Notas opcionales...' : 'Optional notes...'}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditProductionOpen(false)}>
                  {settings.language === 'es' ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button onClick={async () => {
                  if (!editProductionItem) return;
                  
                  const updates: any = {};
                  if (editProductionData.quantity !== editProductionItem.quantity) {
                    updates.quantity = editProductionData.quantity;
                  }
                  if (editProductionData.notes !== (editProductionItem.notes || '')) {
                    updates.notes = editProductionData.notes || null;
                  }
                  if (editProductionData.produced_at !== editProductionItem.produced_at.split('T')[0]) {
                    updates.produced_at = new Date(editProductionData.produced_at).toISOString();
                  }

                  if (Object.keys(updates).length === 0) {
                    toast.info(settings.language === 'es' ? 'No hay cambios' : 'No changes');
                    setEditProductionOpen(false);
                    return;
                  }

                  const success = await updateProduction(
                    editProductionItem.id,
                    updates,
                    editProductionItem.quantity,
                    editProductionItem.product_id
                  );

                  if (success) {
                    setEditProductionOpen(false);
                    refetchProducts();
                  }
                }}>
                  {settings.language === 'es' ? 'Guardar Cambios' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
