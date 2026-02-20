import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePrepaidPackages, PrepaidPackage } from '@/hooks/usePrepaidPackages';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Plus, CreditCard, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PrepaidPackagesManagerProps {
  customerId: string;
  companyId: string;
  customerName: string;
}

export function PrepaidPackagesManager({ customerId, companyId, customerName }: PrepaidPackagesManagerProps) {
  const { formatCurrency } = useSettings();
  const { isAdmin } = useAuth();
  const { packages, loading, createPackage, deactivatePackage } = usePrepaidPackages(customerId);
  const { products } = useProducts();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    total_units: '',
    unit_price: '',
    amount_paid: '',
    notes: '',
    expires_at: '',
  });

  const resetForm = () => {
    setForm({ product_id: '', total_units: '', unit_price: '', amount_paid: '', notes: '', expires_at: '' });
  };

  const handleCreate = async () => {
    if (!form.product_id || !form.total_units || !form.unit_price) return;

    setIsSubmitting(true);
    const success = await createPackage({
      customer_id: customerId,
      product_id: form.product_id,
      company_id: companyId,
      total_units: parseInt(form.total_units),
      unit_price: parseFloat(form.unit_price),
      amount_paid: parseFloat(form.amount_paid) || parseFloat(form.unit_price) * parseInt(form.total_units),
      notes: form.notes || undefined,
      expires_at: form.expires_at || undefined,
    });

    setIsSubmitting(false);
    if (success) {
      resetForm();
      setIsDialogOpen(false);
    }
  };

  const activePackages = (packages || []).filter((p: PrepaidPackage) => p.is_active);
  const inactivePackages = (packages || []).filter((p: PrepaidPackage) => !p.is_active);

  const getUsedUnits = (pkg: PrepaidPackage) => pkg.total_units - pkg.remaining_units;
  const getProgressPercent = (pkg: PrepaidPackage) =>
    Math.round(((pkg.total_units - pkg.remaining_units) / pkg.total_units) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Paquetes Prepagados</h3>
          {activePackages.length > 0 && (
            <Badge variant="default">{activePackages.length} activo{activePackages.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Paquete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo Paquete Prepagado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Cliente: <strong>{customerName}</strong></p>

                <div className="space-y-2">
                  <Label>Producto *</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm(f => ({ ...f, product_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Unidades Totales *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.total_units}
                      onChange={(e) => setForm(f => ({ ...f, total_units: e.target.value }))}
                      placeholder="500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio por Unidad *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.unit_price}
                      onChange={(e) => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      placeholder="8.50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Monto Pagado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount_paid}
                    onChange={(e) => setForm(f => ({ ...f, amount_paid: e.target.value }))}
                    placeholder={
                      form.total_units && form.unit_price
                        ? String(parseFloat(form.unit_price) * parseInt(form.total_units))
                        : '0.00'
                    }
                  />
                  {form.total_units && form.unit_price && (
                    <p className="text-xs text-muted-foreground">
                      Total calculado: {formatCurrency(parseFloat(form.unit_price) * parseInt(form.total_units))}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Vencimiento (opcional)</Label>
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Precio especial de campaña..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { resetForm(); setIsDialogOpen(false); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreate}
                    disabled={isSubmitting || !form.product_id || !form.total_units || !form.unit_price}
                  >
                    {isSubmitting ? 'Creando...' : 'Crear Paquete'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando paquetes...</p>
      ) : (packages || []).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sin paquetes prepagados</p>
            {isAdmin && (
              <p className="text-xs text-muted-foreground mt-1">
                Haz clic en "Nuevo Paquete" para registrar un pago en volumen
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Active packages */}
          {activePackages.map((pkg: PrepaidPackage) => (
            <Card key={pkg.id} className="border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-sm">
                        {(pkg as any).products?.name || 'Producto'}
                      </span>
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Activo
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{getUsedUnits(pkg)} usadas</span>
                        <span>{pkg.remaining_units} restantes de {pkg.total_units}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${getProgressPercent(pkg)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>💰 {formatCurrency(pkg.unit_price)} c/u</span>
                      <span>💳 Pagado: {formatCurrency(pkg.amount_paid)}</span>
                      {pkg.expires_at && (
                        <span>📅 Vence: {format(new Date(pkg.expires_at), 'dd MMM yyyy', { locale: es })}</span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        if (confirm('¿Desactivar este paquete?')) {
                          deactivatePackage(pkg.id);
                        }
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {pkg.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{pkg.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Inactive packages (collapsed) */}
          {inactivePackages.length > 0 && (
            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1 select-none">
                <AlertCircle className="w-3 h-3" />
                {inactivePackages.length} paquete{inactivePackages.length !== 1 ? 's' : ''} completado{inactivePackages.length !== 1 ? 's' : ''}/inactivo{inactivePackages.length !== 1 ? 's' : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {inactivePackages.map((pkg: PrepaidPackage) => (
                  <Card key={pkg.id} className="opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{(pkg as any).products?.name}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-muted-foreground">{getUsedUnits(pkg)}/{pkg.total_units} usadas</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
