import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVolumePricing, VolumePricingRule } from '@/hooks/useVolumePricing';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { Plus, Trash2, Tag, Pencil, Percent } from 'lucide-react';

interface VolumePricingManagerProps {
  productId?: string;
}

export function VolumePricingManager({ productId }: VolumePricingManagerProps) {
  const { rules, loading, addRule, updateRule, deleteRule, toggleRule } = useVolumePricing(productId);
  const { products } = useProducts();
  const { formatCurrency, settings } = useSettings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<VolumePricingRule | null>(null);
  const [selectedProductId, setSelectedProductId] = useState(productId || '');
  const [minQuantity, setMinQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  const resetForm = () => {
    setEditingRule(null);
    setSelectedProductId(productId || '');
    setMinQuantity(1);
    setUnitPrice(0);
  };

  const handleOpenDialog = (rule?: VolumePricingRule) => {
    if (rule) {
      setEditingRule(rule);
      setSelectedProductId(rule.product_id);
      setMinQuantity(rule.min_quantity);
      setUnitPrice(rule.unit_price);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error('Selecciona un producto');
      return;
    }

    if (minQuantity < 2) {
      toast.error('La cantidad mínima debe ser al menos 2');
      return;
    }

    if (unitPrice <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (selectedProduct && unitPrice >= selectedProduct.price) {
      toast.error('El precio con descuento debe ser menor al precio base');
      return;
    }

    if (editingRule) {
      await updateRule(editingRule.id, {
        min_quantity: minQuantity,
        unit_price: unitPrice,
      });
    } else {
      await addRule(selectedProductId, minQuantity, unitPrice);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm(settings.language === 'es' ? '¿Eliminar esta regla de precio?' : 'Delete this pricing rule?')) {
      await deleteRule(id);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleRule(id, isActive);
  };

  // Group rules by product
  const groupedRules = rules.reduce((acc, rule) => {
    const productId = rule.product_id;
    if (!acc[productId]) {
      acc[productId] = [];
    }
    acc[productId].push(rule);
    return acc;
  }, {} as Record<string, VolumePricingRule[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Percent className="w-5 h-5" />
            {settings.language === 'es' ? 'Precios por Volumen' : 'Volume Pricing'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {settings.language === 'es' 
              ? 'Configura descuentos automáticos por cantidad'
              : 'Configure automatic quantity discounts'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              {settings.language === 'es' ? 'Nueva Regla' : 'New Rule'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRule 
                  ? (settings.language === 'es' ? 'Editar Regla' : 'Edit Rule')
                  : (settings.language === 'es' ? 'Nueva Regla de Precio' : 'New Pricing Rule')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!productId && (
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Producto' : 'Product'}</Label>
                  <Select 
                    value={selectedProductId} 
                    onValueChange={setSelectedProductId}
                    disabled={!!editingRule}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={settings.language === 'es' ? 'Seleccionar producto' : 'Select product'} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Desde (unidades)' : 'From (units)'}</Label>
                  <Input
                    type="number"
                    min="2"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(parseInt(e.target.value) || 0)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.language === 'es' 
                      ? 'Cantidad mínima para aplicar'
                      : 'Minimum quantity to apply'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{settings.language === 'es' ? 'Precio Unitario' : 'Unit Price'}</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.language === 'es' 
                      ? 'Precio con descuento'
                      : 'Discounted price'}
                  </p>
                </div>
              </div>

              {selectedProductId && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">
                      {settings.language === 'es' ? 'Vista previa: ' : 'Preview: '}
                    </span>
                    {settings.language === 'es' 
                      ? `Desde ${minQuantity} unidades, el precio será ${formatCurrency(unitPrice)} c/u`
                      : `From ${minQuantity} units, price will be ${formatCurrency(unitPrice)} each`}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  {settings.language === 'es' ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button type="submit" className="flex-1">
                  {editingRule 
                    ? (settings.language === 'es' ? 'Guardar' : 'Save')
                    : (settings.language === 'es' ? 'Crear' : 'Create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {settings.language === 'es' ? 'Cargando...' : 'Loading...'}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{settings.language === 'es' 
              ? 'No hay reglas de precio por volumen configuradas'
              : 'No volume pricing rules configured'}</p>
            <p className="text-sm mt-1">
              {settings.language === 'es'
                ? 'Crea una regla para aplicar descuentos automáticos por cantidad'
                : 'Create a rule to apply automatic quantity discounts'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedRules).map(([prodId, productRules]) => {
            const product = products.find(p => p.id === prodId);
            if (!product) return null;

            return (
              <Card key={prodId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    {product.name}
                  </CardTitle>
                  <CardDescription>
                    {settings.language === 'es' ? 'Precio base: ' : 'Base price: '}
                    {formatCurrency(product.price)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {productRules
                    .sort((a, b) => a.min_quantity - b.min_quantity)
                    .map(rule => {
                      const discount = ((product.price - rule.unit_price) / product.price * 100).toFixed(0);
                      return (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            rule.is_active ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-muted border-transparent'
                          }`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {settings.language === 'es' ? 'Desde ' : 'From '}
                              {rule.min_quantity} {settings.language === 'es' ? 'unidades' : 'units'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(rule.unit_price)} c/u
                              <span className="text-green-600 ml-2">(-{discount}%)</span>
                            </p>
                          </div>
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(rule)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
