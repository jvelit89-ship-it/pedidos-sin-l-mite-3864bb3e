import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useProducts, useProductionHistory } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
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
  History
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  stock: number;
  min_stock: number;
  price: number;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export default function InventoryPage() {
  const { products, loading, addProduct, updateProduct } = useProducts();
  const { history, addProduction } = useProductionHistory();
  const { formatCurrency, settings, t } = useSettings();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productionQuantity, setProductionQuantity] = useState(0);
  const [productionNotes, setProductionNotes] = useState('');

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
    });
    setEditingProduct(null);
  };

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
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        name: formData.name,
        sku: formData.sku,
        category: formData.category || null,
        stock: formData.stock,
        min_stock: formData.min_stock,
        price: formData.price,
        notes: formData.notes || null,
      });
    } else {
      await addProduct({
        name: formData.name,
        sku: formData.sku,
        category: formData.category || null,
        stock: formData.stock,
        min_stock: formData.min_stock,
        price: formData.price,
        notes: formData.notes || null,
      });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleProduction = async () => {
    if (!selectedProductId || productionQuantity <= 0) {
      toast.error(settings.language === 'es' ? 'Selecciona un producto y cantidad' : 'Select a product and quantity');
      return;
    }
    
    const success = await addProduction(selectedProductId, productionQuantity, productionNotes);
    
    if (success) {
      setIsProductionDialogOpen(false);
      setSelectedProductId('');
      setProductionQuantity(0);
      setProductionNotes('');
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stock === 0) return { status: 'out', label: settings.language === 'es' ? 'Agotado' : 'Out of stock', className: 'stock-out' };
    if (product.stock <= product.min_stock) return { status: 'low', label: settings.language === 'es' ? 'Stock bajo' : 'Low stock', className: 'stock-low' };
    return { status: 'normal', label: 'Normal', className: 'stock-normal' };
  };

  const filteredProducts = products.filter((p: Product) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: products.length,
    normal: products.filter((p: Product) => p.stock > p.min_stock).length,
    low: products.filter((p: Product) => p.stock > 0 && p.stock <= p.min_stock).length,
    out: products.filter((p: Product) => p.stock === 0).length,
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
          
          {/* Production Dialog */}
          <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Factory className="w-4 h-4" />
                <span className="hidden sm:inline">{settings.language === 'es' ? 'Registrar Producción' : 'Register Production'}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {settings.language === 'es' ? 'Registrar Producción' : 'Register Production'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Producto' : 'Product'}</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder={settings.language === 'es' ? 'Seleccionar producto' : 'Select product'} /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: Product) => (
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
                    value={productionQuantity}
                    onChange={(e) => setProductionQuantity(parseInt(e.target.value) || 0)}
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
                  <Button className="flex-1" onClick={handleProduction}>
                    {settings.language === 'es' ? 'Registrar' : 'Register'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Product Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{settings.language === 'es' ? 'Nuevo Producto' : 'New Product'}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
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
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{settings.language === 'es' ? 'Stock Mínimo' : 'Min Stock'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{settings.language === 'es' ? 'Precio Unitario' : 'Unit Price'} *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      required
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="w-4 h-4" />
            {settings.language === 'es' ? 'Inventario' : 'Inventory'}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            {settings.language === 'es' ? 'Historial' : 'History'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold stock-normal">{stats.normal}</p>
                <p className="text-xs text-muted-foreground">Normal</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold stock-low">{stats.low}</p>
                <p className="text-xs text-muted-foreground">{settings.language === 'es' ? 'Bajo' : 'Low'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold stock-out">{stats.out}</p>
                <p className="text-xs text-muted-foreground">{settings.language === 'es' ? 'Agotado' : 'Out'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={settings.language === 'es' ? 'Buscar por nombre, SKU o categoría...' : 'Search by name, SKU or category...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products List */}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product: Product, index: number) => {
                const stockInfo = getStockStatus(product);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="card-interactive h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            {stockInfo.status === 'out' && <AlertTriangle className="w-4 h-4 stock-out" />}
                            {stockInfo.status === 'low' && <AlertTriangle className="w-4 h-4 stock-low" />}
                            {stockInfo.status === 'normal' && <CheckCircle2 className="w-4 h-4 stock-normal" />}
                            <span className={`text-sm font-medium ${stockInfo.className}`}>
                              {product.stock} {settings.language === 'es' ? 'unidades' : 'units'}
                            </span>
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
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">
                {settings.language === 'es' ? 'Historial de Producción' : 'Production History'}
              </h3>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t.noData}</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{item.products?.name || 'Producto'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(item.produced_at), 'PPp', { locale })}
                        </p>
                        {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">+{item.quantity}</span>
                        <p className="text-xs text-muted-foreground">{settings.language === 'es' ? 'unidades' : 'units'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
