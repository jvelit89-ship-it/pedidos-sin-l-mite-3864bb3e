import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  const [promotionDays, setPromotionDays] = useState<number[]>([]);
  const [isOnlineExclusive, setIsOnlineExclusive] = useState(false);

  const resetForm = () => {
    setEditingRule(null);
    setSelectedProductId(productId || '');
    setMinQuantity(1);
    setUnitPrice(0);
    setPromotionDays([]);
    setIsOnlineExclusive(false);
  };

  const handleOpenDialog = (rule?: VolumePricingRule) => {
    if (rule) {
      setEditingRule(rule);
      setSelectedProductId(rule.product_id);
      setMinQuantity(rule.min_quantity);
      setUnitPrice(rule.unit_price);
      setPromotionDays(rule.promotion_days || []);
      setIsOnlineExclusive(rule.is_online_exclusive || false);
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

    if (minQuantity < 1) {
      toast.error('La cantidad mínima debe ser al menos 1');
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
        promotion_days: promotionDays,
        is_online_exclusive: isOnlineExclusive,
      });
    } else {
      await addRule(selectedProductId, minQuantity, unitPrice, promotionDays, isOnlineExclusive);
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
          <DialogContent 
            className="sm:max-w-md"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
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
                    min="1"
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
                    min="0.0001"
                    step="0.0001"
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

              <div className="space-y-3">
                <Label>{settings.language === 'es' ? 'Días de Promoción (Opcional)' : 'Promotion Days (Optional)'}</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'L', value: 1 },
                    { label: 'M', value: 2 },
                    { label: 'Mi', value: 3 },
                    { label: 'J', value: 4 },
                    { label: 'V', value: 5 },
                    { label: 'S', value: 6 },
                    { label: 'D', value: 0 },
                  ].map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={promotionDays.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setPromotionDays(prev => 
                          prev.includes(day.value) 
                            ? prev.filter(d => d !== day.value) 
                            : [...prev, day.value]
                        );
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.language === 'es' 
                    ? 'Si no seleccionas días, se aplicará siempre'
                    : 'If no days are selected, it will always apply'}
                </p>
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Switch 
                  id="online-exclusive" 
                  checked={isOnlineExclusive} 
                  onCheckedChange={setIsOnlineExclusive}
                />
                <Label htmlFor="online-exclusive" className="cursor-pointer">
                  {settings.language === 'es' ? 'Exclusivo Pedidos Online' : 'Online Orders Exclusive'}
                </Label>
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
                                {rule.is_online_exclusive && (
                                  <Badge variant="outline" className="ml-2 text-[10px] h-4">Online</Badge>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rule.promotion_days && rule.promotion_days.length > 0 ? (
                                  rule.promotion_days.sort((a,b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(day => (
                                    <span key={day} className="text-[10px] bg-primary/10 text-primary px-1 rounded">
                                      {['D', 'L', 'M', 'Mi', 'J', 'V', 'S'][day]}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">
                                    {settings.language === 'es' ? 'Todos los días' : 'Every day'}
                                  </span>
                                )}
                              </div>
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
