import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PackagePlus,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  PackageX,
  Minus,
  Plus,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { useTruckExtraLoad, TruckExtraLoadItem } from '@/hooks/useTruckExtraLoad';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';

interface LoadItemEntry {
  productId: string;
  productName: string;
  quantity: number;
  maxStock: number;
}

export function TruckExtraLoadPanel() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const { activeLoad, loadItems, loading, createLoad, registerSale, closeLoad } = useTruckExtraLoad();
  const { products } = useProducts();
  const [isOpen, setIsOpen] = useState(true);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [loadEntries, setLoadEntries] = useState<LoadItemEntry[]>([]);
  const [loadNotes, setLoadNotes] = useState('');
  const [selectedItem, setSelectedItem] = useState<TruckExtraLoadItem | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [selectedRepartidorId, setSelectedRepartidorId] = useState<string>('');

  const isRepartidor = user?.role === 'repartidor';
  const repartidorId = user?.repartidorId;

  // Available products (with stock > 0)
  const availableProducts = products.filter(p => p.stock > 0);

  const addProductToLoad = (productId: string) => {
    if (loadEntries.some(e => e.productId === productId)) {
      toast.error('Este producto ya está en la lista');
      return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setLoadEntries(prev => [
      ...prev,
      { productId: product.id, productName: product.name, quantity: 1, maxStock: product.stock },
    ]);
  };

  const updateEntryQuantity = (productId: string, qty: number) => {
    setLoadEntries(prev =>
      prev.map(e =>
        e.productId === productId
          ? { ...e, quantity: Math.max(1, Math.min(qty, e.maxStock)) }
          : e
      )
    );
  };

  const removeEntry = (productId: string) => {
    setLoadEntries(prev => prev.filter(e => e.productId !== productId));
  };

  const handleCreateLoad = async () => {
    const targetId = isRepartidor ? repartidorId : selectedRepartidorId;
    if (!targetId) {
      toast.error('Selecciona un repartidor');
      return;
    }
    if (loadEntries.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    await createLoad(
      targetId,
      loadEntries.map(e => ({ productId: e.productId, quantity: e.quantity })),
      loadNotes || undefined
    );
    setShowLoadDialog(false);
    setLoadEntries([]);
    setLoadNotes('');
  };

  const handleRegisterSale = async () => {
    if (!selectedItem) return;
    await registerSale(selectedItem.id, saleQuantity);
    setShowSaleDialog(false);
    setSelectedItem(null);
    setSaleQuantity(1);
  };

  const handleCloseLoad = async () => {
    await closeLoad();
    setShowCloseDialog(false);
  };

  const openSaleDialog = (item: TruckExtraLoadItem) => {
    setSelectedItem(item);
    setSaleQuantity(1);
    setShowSaleDialog(true);
  };

  const totalLoaded = loadItems.reduce((s, i) => s + i.quantity_loaded, 0);
  const totalSold = loadItems.reduce((s, i) => s + i.quantity_sold, 0);
  const totalRemaining = loadItems.reduce(
    (s, i) => s + (i.quantity_loaded - i.quantity_sold - i.quantity_returned),
    0
  );

  if (loading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/30 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Carga Extra del Camión</h3>
                  <p className="text-xs text-muted-foreground">
                    {activeLoad
                      ? `${totalRemaining} unidades restantes de ${totalLoaded} cargadas`
                      : 'Sin carga activa'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeLoad && (
                  <Badge variant="default" className="text-xs">
                    Activa
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-4">
            {!activeLoad ? (
              /* No active load */
              <div className="text-center py-4">
                <PackagePlus className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-3">
                  No hay carga extra activa
                </p>
                <Button onClick={() => setShowLoadDialog(true)} className="gap-2">
                  <PackagePlus className="w-4 h-4" />
                  Cargar Extras
                </Button>
              </div>
            ) : (
              /* Active load - show items */
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{totalLoaded}</p>
                    <p className="text-xs text-muted-foreground">Cargados</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-primary">{totalSold}</p>
                    <p className="text-xs text-muted-foreground">Vendidos</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-destructive">{totalRemaining}</p>
                    <p className="text-xs text-muted-foreground">Restantes</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <AnimatePresence>
                    {loadItems.map(item => {
                      const remaining = item.quantity_loaded - item.quantity_sold - item.quantity_returned;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-background border"
                        >
                          <div>
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Cargado: {item.quantity_loaded} · Vendido: {item.quantity_sold}
                              {item.quantity_returned > 0 && ` · Devuelto: ${item.quantity_returned}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={remaining > 0 ? 'secondary' : 'outline'} className="text-xs">
                              {remaining} disp.
                            </Badge>
                            {remaining > 0 && activeLoad.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSaleDialog(item)}
                                className="h-7 text-xs gap-1"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                Vender
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {activeLoad.status === 'active' && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCloseDialog(true)}
                    className="w-full gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Cerrar Carga y Devolver al Almacén
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cargar Extras al Camión</DialogTitle>
            <DialogDescription>
              Selecciona productos y cantidades. Se descontarán del inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product selector */}
            <div>
              <Label>Agregar Producto</Label>
              <Select onValueChange={addProductToLoad}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected products */}
            {loadEntries.length > 0 && (
              <div className="space-y-2">
                <Label>Productos a cargar</Label>
                {loadEntries.map(entry => (
                  <div
                    key={entry.productId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{entry.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Máx: {entry.maxStock}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateEntryQuantity(entry.productId, entry.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        value={entry.quantity}
                        onChange={e => updateEntryQuantity(entry.productId, parseInt(e.target.value) || 1)}
                        className="w-16 h-7 text-center text-sm"
                        min={1}
                        max={entry.maxStock}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateEntryQuantity(entry.productId, entry.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeEntry(entry.productId)}
                      >
                        <PackageX className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={loadNotes}
                onChange={e => setLoadNotes(e.target.value)}
                placeholder="Observaciones de la carga..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLoad} disabled={loadEntries.length === 0}>
              <PackagePlus className="w-4 h-4 mr-2" />
              Cargar al Camión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Venta al Paso</DialogTitle>
            <DialogDescription>
              {selectedItem?.product_name} — Disponible:{' '}
              {selectedItem
                ? selectedItem.quantity_loaded - selectedItem.quantity_sold
                : 0}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Cantidad a vender</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setSaleQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={saleQuantity}
                  onChange={e => setSaleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                  min={1}
                  max={
                    selectedItem
                      ? selectedItem.quantity_loaded - selectedItem.quantity_sold
                      : 1
                  }
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setSaleQuantity(q =>
                      Math.min(
                        q + 1,
                        selectedItem
                          ? selectedItem.quantity_loaded - selectedItem.quantity_sold
                          : 1
                      )
                    )
                  }
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterSale}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Registrar Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Carga Extra</DialogTitle>
            <DialogDescription>
              Se devolverán {totalRemaining} unidades no vendidas al inventario del almacén.
            </DialogDescription>
          </DialogHeader>

          {totalRemaining > 0 && (
            <div className="space-y-2">
              {loadItems
                .filter(i => i.quantity_loaded - i.quantity_sold > 0)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-2 rounded bg-muted/50 text-sm"
                  >
                    <span>{item.product_name}</span>
                    <Badge variant="secondary">
                      +{item.quantity_loaded - item.quantity_sold} al almacén
                    </Badge>
                  </div>
                ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCloseLoad}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Confirmar Cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
