import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePurchases } from '@/hooks/usePurchases';
import { useSuppliers, SupplierFormData } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save,
  Loader2,
  Check,
  ChevronsUpDown,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  current_stock: number;
  quantity: number;
  unit_cost: number;
}

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const { formatCurrency } = useSettings();
  const { 
    createPurchase,
    isCreatingPurchase,
  } = usePurchases();
  const {
    suppliers,
    loadingSuppliers,
    createSupplier,
    isCreating: isCreatingSupplier,
  } = useSuppliers();
  const { products, loading: loadingProducts } = useProducts();

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [receiptType, setReceiptType] = useState('factura');
  const [includesTax, setIncludesTax] = useState(true);
  const [receiptSeries, setReceiptSeries] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currency, setCurrency] = useState('PEN');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItemRow[]>([]);

  // UI state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<string | null>(null);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState<SupplierFormData>({ name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_id: '',
        product_name: '',
        product_sku: '',
        current_stock: 0,
        quantity: 1,
        unit_cost: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PurchaseItemRow, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const selectProduct = (itemId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setItems(items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            current_stock: product.stock,
          };
        }
        return item;
      }));
    }
    setProductOpen(null);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const calculateTax = () => {
    return includesTax ? calculateSubtotal() * 0.18 : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!supplierId) newErrors.supplier = 'Seleccione un proveedor';
    if (!receiptNumber.trim()) newErrors.receiptNumber = 'Ingrese el número de comprobante';
    if (!issueDate) newErrors.issueDate = 'Seleccione la fecha';
    if (items.length === 0) newErrors.items = 'Agregue al menos un producto';

    items.forEach((item, index) => {
      if (!item.product_id) newErrors[`item_${index}_product`] = 'Seleccione un producto';
      if (item.quantity <= 0) newErrors[`item_${index}_quantity`] = 'Cantidad inválida';
      if (item.unit_cost < 0) newErrors[`item_${index}_cost`] = 'Costo inválido';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await createPurchase({
        supplier_id: supplierId,
        receipt_type: receiptType,
        receipt_series: receiptSeries || undefined,
        receipt_number: receiptNumber,
        issue_date: issueDate,
        currency,
        includes_tax: includesTax,
        notes: notes || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      });
      navigate('/purchases');
    } catch (error) {
      console.error('Error creating purchase:', error);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierData.name.trim()) return;
    
    try {
      const supplier = await createSupplier(newSupplierData);
      setSupplierId(supplier.id);
      setNewSupplierDialogOpen(false);
      setNewSupplierData({ name: '' });
    } catch (error) {
      console.error('Error creating supplier:', error);
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchases')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nueva Compra</h1>
          <p className="text-muted-foreground">Registrar ingreso de mercadería</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Data */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del Comprobante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <div className="flex gap-2">
                  <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierOpen}
                        className={cn(
                          "flex-1 justify-between",
                          errors.supplier && "border-destructive"
                        )}
                      >
                        {selectedSupplier ? selectedSupplier.name : "Seleccionar proveedor..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar proveedor..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron proveedores</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.name}
                                onSelect={() => {
                                  setSupplierId(supplier.id);
                                  setSupplierOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {supplier.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSupplierDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {errors.supplier && <p className="text-sm text-destructive">{errors.supplier}</p>}
              </div>

              {/* Receipt Type */}
              <div className="space-y-2">
                <Label>Tipo de Comprobante</Label>
                <Select value={receiptType} onValueChange={(val) => {
                  setReceiptType(val);
                  if (val === 'nota_venta') setIncludesTax(false);
                  else setIncludesTax(true);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="nota_venta">Nota de Venta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Includes IGV */}
              <div className="space-y-2">
                <Label>¿Incluye IGV?</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    checked={includesTax}
                    onCheckedChange={setIncludesTax}
                  />
                  <span className="text-sm text-muted-foreground">
                    {includesTax ? 'Sí, incluye IGV (18%)' : 'No incluye IGV'}
                  </span>
                </div>
              </div>

              {/* Series */}
              <div className="space-y-2">
                <Label>Serie</Label>
                <Input
                  value={receiptSeries}
                  onChange={(e) => setReceiptSeries(e.target.value.toUpperCase())}
                  placeholder="F001"
                  maxLength={4}
                />
              </div>

              {/* Number */}
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="00000123"
                  className={errors.receiptNumber ? "border-destructive" : ""}
                />
                {errors.receiptNumber && <p className="text-sm text-destructive">{errors.receiptNumber}</p>}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Fecha de Emisión *</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className={errors.issueDate ? "border-destructive" : ""}
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">Soles (PEN)</SelectItem>
                    <SelectItem value="USD">Dólares (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre la compra..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              {includesTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGV (18%)</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <Button 
              onClick={handleSubmit} 
              className="w-full gap-2"
              disabled={isCreatingPurchase}
            >
              {isCreatingPurchase ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Compra
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detalle de Productos</CardTitle>
            <Button onClick={addItem} variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar Producto
            </Button>
          </div>
          {errors.items && <p className="text-sm text-destructive mt-2">{errors.items}</p>}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right w-[100px]">Cantidad</TableHead>
                  <TableHead className="text-right w-[120px]">Costo Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay productos agregados. Haga clic en "Agregar Producto" para comenzar.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Popover 
                          open={productOpen === item.id} 
                          onOpenChange={(open) => setProductOpen(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between text-left font-normal",
                                !item.product_id && "text-muted-foreground",
                                errors[`item_${index}_product`] && "border-destructive"
                              )}
                            >
                              {item.product_name || "Seleccionar producto..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar producto..." />
                              <CommandList>
                                <CommandEmpty>No se encontraron productos</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku}`}
                                      onSelect={() => selectProduct(item.id, product.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.product_id === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div>
                                        <p>{product.name}</p>
                                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.product_sku || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.current_stock}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className={cn(
                            "text-right",
                            errors[`item_${index}_quantity`] && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className={cn(
                            "text-right",
                            errors[`item_${index}_cost`] && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.quantity * item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Supplier Dialog */}
      <Dialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Nuevo Proveedor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre / Razón Social *</Label>
              <Input
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>RUC</Label>
                <Input
                  value={newSupplierData.ruc || ''}
                  onChange={(e) => setNewSupplierData({ ...newSupplierData, ruc: e.target.value })}
                  placeholder="20123456789"
                  maxLength={11}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={newSupplierData.phone || ''}
                  onChange={(e) => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
                  placeholder="999 999 999"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newSupplierData.email || ''}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, email: e.target.value })}
                placeholder="proveedor@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={newSupplierData.address || ''}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, address: e.target.value })}
                placeholder="Dirección del proveedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplierDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateSupplier}
              disabled={!newSupplierData.name.trim() || isCreatingSupplier}
            >
              {isCreatingSupplier ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Guardar Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
