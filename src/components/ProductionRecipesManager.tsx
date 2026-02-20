import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProductionRecipes, useProductionWaste, useAdvancedProduction } from '@/hooks/useProductionRecipes';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { 
  Plus, 
  Link, 
  Trash2,
  AlertTriangle,
  Loader2,
  Factory,
  ArrowRight,
  Package
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductionRecipesManagerProps {
  onProductionComplete?: () => void;
}

export function ProductionRecipesManager({ onProductionComplete }: ProductionRecipesManagerProps) {
  const { settings } = useSettings();
  const locale = settings.language === 'es' ? es : enUS;
  
  const { recipes, loading: loadingRecipes, addRecipe, deleteRecipe, getRecipesForProduct } = useProductionRecipes();
  const { waste, loading: loadingWaste, registerWaste } = useProductionWaste();
  const { produceWithRecipe } = useAdvancedProduction();
  const { products, refetch: refetchProducts } = useProducts();
  
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [isProduceOpen, setIsProduceOpen] = useState(false);
  const [isWasteOpen, setIsWasteOpen] = useState(false);
  
  // Recipe form
  const [recipeForm, setRecipeForm] = useState({
    outputProductId: '',
    inputProductId: '',
    quantityRatio: 1,
  });
  
  // Production form
  const [productionForm, setProductionForm] = useState({
    outputProductId: '',
    quantity: 0,
    wasteQuantity: 0,
    wasteReason: '',
    notes: '',
  });
  
  // Waste form
  const [wasteForm, setWasteForm] = useState({
    productId: '',
    quantity: 0,
    reason: '',
  });

  const handleAddRecipe = async () => {
    if (!recipeForm.outputProductId || !recipeForm.inputProductId) {
      toast.error('Selecciona ambos productos');
      return;
    }
    if (recipeForm.outputProductId === recipeForm.inputProductId) {
      toast.error('Los productos deben ser diferentes');
      return;
    }

    await addRecipe(recipeForm.outputProductId, recipeForm.inputProductId, recipeForm.quantityRatio);
    setRecipeForm({ outputProductId: '', inputProductId: '', quantityRatio: 1 });
    setIsAddRecipeOpen(false);
  };

  const handleProduce = async () => {
    if (!productionForm.outputProductId || productionForm.quantity <= 0) {
      toast.error('Selecciona un producto y cantidad');
      return;
    }

    const success = await produceWithRecipe(
      productionForm.outputProductId,
      productionForm.quantity,
      productionForm.wasteQuantity,
      productionForm.wasteReason,
      productionForm.notes
    );

    if (success) {
      await refetchProducts();
      onProductionComplete?.();
      setProductionForm({ outputProductId: '', quantity: 0, wasteQuantity: 0, wasteReason: '', notes: '' });
      setIsProduceOpen(false);
    }
  };

  const handleRegisterWaste = async () => {
    if (!wasteForm.productId || wasteForm.quantity <= 0) {
      toast.error('Selecciona un producto y cantidad');
      return;
    }

    const success = await registerWaste(wasteForm.productId, wasteForm.quantity, wasteForm.reason);
    if (success) {
      await refetchProducts();
      setWasteForm({ productId: '', quantity: 0, reason: '' });
      setIsWasteOpen(false);
    }
  };

  const selectedRecipes = getRecipesForProduct(productionForm.outputProductId);
  
  // Check if selected product has recipes
  const selectedProductHasRecipes = selectedRecipes.length > 0;

  // Get required input stock
  const getRequiredInputInfo = () => {
    if (!selectedProductHasRecipes || productionForm.quantity <= 0) return null;
    
    return selectedRecipes.map(recipe => {
      const inputProduct = products.find((p: any) => p.id === recipe.input_product_id);
      const requiredQty = productionForm.quantity * recipe.quantity_ratio;
      const hasEnough = inputProduct && inputProduct.stock >= requiredQty;
      
      return {
        recipe,
        inputProduct,
        requiredQty,
        hasEnough,
      };
    });
  };

  const inputInfo = getRequiredInputInfo();

  if (loadingRecipes) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="produce">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="produce">Producir</TabsTrigger>
          <TabsTrigger value="recipes">Recetas</TabsTrigger>
          <TabsTrigger value="waste">Mermas</TabsTrigger>
        </TabsList>

        {/* Produce Tab */}
        <TabsContent value="produce" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Factory className="w-5 h-5" />
                Producción con Receta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Producto a Producir (Final)</Label>
                <Select 
                  value={productionForm.outputProductId} 
                  onValueChange={(v) => setProductionForm({ ...productionForm, outputProductId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto final..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter((p: any) => !p.product_type || p.product_type === 'final').map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Stock: {p.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show recipe requirements */}
              {productionForm.outputProductId && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  {selectedProductHasRecipes ? (
                    <>
                      <p className="text-sm font-medium">Materiales requeridos:</p>
                      {selectedRecipes.map(recipe => {
                        const inputProduct = products.find((p: any) => p.id === recipe.input_product_id);
                        return (
                          <div key={recipe.id} className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span>{inputProduct?.name || 'Producto'}</span>
                            <Badge variant="outline">Stock: {inputProduct?.stock || 0}</Badge>
                            <span className="text-muted-foreground">({recipe.quantity_ratio}:1)</span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Este producto no tiene receta configurada. La producción será directa.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad a Producir</Label>
                  <Input
                    type="number"
                    min="1"
                    value={productionForm.quantity}
                    onChange={(e) => setProductionForm({ ...productionForm, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Merma / Fallidos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={productionForm.wasteQuantity}
                    onChange={(e) => setProductionForm({ ...productionForm, wasteQuantity: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Show input requirements if has quantity */}
              {inputInfo && inputInfo.length > 0 && productionForm.quantity > 0 && (
                <div className="p-3 border rounded-lg space-y-2">
                  <p className="text-sm font-medium">Se consumirán:</p>
                  {inputInfo.map(({ recipe, inputProduct, requiredQty, hasEnough }) => (
                    <div 
                      key={recipe.id} 
                      className={`flex items-center justify-between text-sm ${!hasEnough ? 'text-destructive' : ''}`}
                    >
                      <span>{inputProduct?.name || 'Material'}</span>
                      <div className="flex items-center gap-2">
                        <span>{requiredQty} unidades</span>
                        {!hasEnough && (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {productionForm.wasteQuantity > 0 && (
                <div className="space-y-2">
                  <Label>Motivo de la Merma</Label>
                  <Input
                    value={productionForm.wasteReason}
                    onChange={(e) => setProductionForm({ ...productionForm, wasteReason: e.target.value })}
                    placeholder="Ej: Botellas deformadas, fugas, etc."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={productionForm.notes}
                  onChange={(e) => setProductionForm({ ...productionForm, notes: e.target.value })}
                  placeholder="Observaciones de producción..."
                  rows={2}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleProduce}
                disabled={!productionForm.outputProductId || productionForm.quantity <= 0}
              >
                <Factory className="w-4 h-4 mr-2" />
                Registrar Producción
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipes Tab */}
        <TabsContent value="recipes" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Recetas de Producción</h3>
            <Dialog open={isAddRecipeOpen} onOpenChange={setIsAddRecipeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nueva Receta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Receta de Producción</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Define qué materiales se consumen al producir un producto. 
                    Por ejemplo: Al producir "Agua 8L", se consume 1 "Botella PET Vacía".
                  </p>
                  
                  <div className="space-y-2">
                    <Label>🧪 Material de Entrada (Materia Prima)</Label>
                    <Select 
                      value={recipeForm.inputProductId} 
                      onValueChange={(v) => setRecipeForm({ ...recipeForm, inputProductId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar materia prima..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter((p: any) => p.product_type === 'raw_material').map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                        {products.filter((p: any) => p.product_type === 'raw_material').length === 0 && (
                          <SelectItem value="_none" disabled>No hay materias primas definidas</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label>🛒 Producto de Salida (Producto Final)</Label>
                    <Select 
                      value={recipeForm.outputProductId} 
                      onValueChange={(v) => setRecipeForm({ ...recipeForm, outputProductId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto final..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter((p: any) => !p.product_type || p.product_type === 'final').map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ratio (materiales por unidad producida)</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={recipeForm.quantityRatio}
                      onChange={(e) => setRecipeForm({ ...recipeForm, quantityRatio: parseFloat(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ejemplo: 1 significa que por cada unidad producida se consume 1 material
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsAddRecipeOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={handleAddRecipe}>
                      Crear Receta
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {recipes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Link className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay recetas configuradas</p>
                <p className="text-sm text-muted-foreground">
                  Crea recetas para automatizar el consumo de materiales
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-medium">{recipe.input_product?.name || 'Material'}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="font-medium text-primary">{recipe.output_product?.name || 'Producto'}</span>
                      </div>
                      <Badge variant="outline">{recipe.quantity_ratio}:1</Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteRecipe(recipe.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Waste Tab */}
        <TabsContent value="waste" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Registro de Mermas</h3>
            <Dialog open={isWasteOpen} onOpenChange={setIsWasteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Registrar Merma
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Merma / Pérdida</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <Select 
                      value={wasteForm.productId} 
                      onValueChange={(v) => setWasteForm({ ...wasteForm, productId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} - Stock: {p.stock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad Perdida</Label>
                    <Input
                      type="number"
                      min="1"
                      value={wasteForm.quantity}
                      onChange={(e) => setWasteForm({ ...wasteForm, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Input
                      value={wasteForm.reason}
                      onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                      placeholder="Ej: Rotura, vencimiento, defecto..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsWasteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={handleRegisterWaste}>
                      Registrar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingWaste ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : waste.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay mermas registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {waste.slice(0, 10).map((w: any) => (
                <Card key={w.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-destructive">-{w.quantity} {w.products?.name}</p>
                        {w.reason && <p className="text-sm text-muted-foreground">{w.reason}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(w.created_at), 'Pp', { locale })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
