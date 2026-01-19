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
import { useDistributorCredits, useCreditUsage, useDistributorSummary } from '@/hooks/useDistributorCredits';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { 
  Plus, 
  Package, 
  History, 
  Loader2, 
  CreditCard,
  Minus,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface DistributorCreditsManagerProps {
  customerId: string;
  customerName: string;
  onCreditsChange?: () => void;
}

const PRESET_PACKAGES = [
  { name: 'S/2000 x 500 recargas', credits: 500, amount: 2000 },
  { name: 'S/1000 x 240 recargas', credits: 240, amount: 1000 },
  { name: 'S/500 x 115 recargas', credits: 115, amount: 500 },
];

export function DistributorCreditsManager({ customerId, customerName, onCreditsChange }: DistributorCreditsManagerProps) {
  const { formatCurrency, settings } = useSettings();
  const locale = settings.language === 'es' ? es : enUS;
  
  const { credits, loading, addCreditPackage, deactivatePackage, refetch: refetchCredits } = useDistributorCredits(customerId);
  const { registerPickup } = useCreditUsage();
  const { getDistributorStats } = useDistributorSummary();
  const { products } = useProducts();
  
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
  const [isPickupOpen, setIsPickupOpen] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState<string>('');
  
  // Add package form
  const [packageForm, setPackageForm] = useState({
    packageName: '',
    totalCredits: 0,
    amountPaid: 0,
    notes: '',
  });
  
  // Pickup form
  const [pickupForm, setPickupForm] = useState({
    quantity: 1,
    productId: '',
    notes: '',
  });

  const stats = getDistributorStats(customerId);

  // Filter products that are likely "recargas" (20L water bottles)
  const recargaProducts = products.filter((p: any) => 
    p.name.toLowerCase().includes('recarga') || 
    p.name.toLowerCase().includes('20l') ||
    p.name.toLowerCase().includes('bidón')
  );

  const handleSelectPreset = (preset: typeof PRESET_PACKAGES[0]) => {
    setPackageForm({
      ...packageForm,
      packageName: preset.name,
      totalCredits: preset.credits,
      amountPaid: preset.amount,
    });
  };

  const handleAddPackage = async () => {
    if (!packageForm.packageName || packageForm.totalCredits <= 0 || packageForm.amountPaid <= 0) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    await addCreditPackage(
      customerId,
      packageForm.packageName,
      packageForm.totalCredits,
      packageForm.amountPaid,
      packageForm.notes
    );

    setPackageForm({ packageName: '', totalCredits: 0, amountPaid: 0, notes: '' });
    setIsAddPackageOpen(false);
  };

  const handlePickup = async () => {
    if (!selectedCreditId || pickupForm.quantity <= 0 || !pickupForm.productId) {
      toast.error('Selecciona un paquete, producto y cantidad');
      return;
    }

    const success = await registerPickup(selectedCreditId, pickupForm.quantity, pickupForm.productId, pickupForm.notes);
    
    if (success) {
      refetchCredits();
      onCreditsChange?.();
    }
    
    setPickupForm({ quantity: 1, productId: '', notes: '' });
    setSelectedCreditId('');
    setIsPickupOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Resumen de Créditos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.totalRemaining}</p>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.totalUsed}</p>
              <p className="text-xs text-muted-foreground">Usadas</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{stats.totalPurchased}</p>
              <p className="text-xs text-muted-foreground">Total Compradas</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPaid)}</p>
              <p className="text-xs text-muted-foreground">Total Pagado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Dialog open={isAddPackageOpen} onOpenChange={setIsAddPackageOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Paquete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago Anticipado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Preset buttons */}
              <div className="space-y-2">
                <Label>Paquetes Predefinidos</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_PACKAGES.map((preset) => (
                    <Button
                      key={preset.name}
                      type="button"
                      variant="outline"
                      className="justify-start h-auto py-2"
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="text-left">
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(preset.amount)} por {preset.credits} recargas
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Nombre del Paquete</Label>
                  <Input
                    value={packageForm.packageName}
                    onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })}
                    placeholder="Ej: S/2000 x 500 recargas"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Recargas</Label>
                    <Input
                      type="number"
                      min="1"
                      value={packageForm.totalCredits}
                      onChange={(e) => setPackageForm({ ...packageForm, totalCredits: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto Pagado (S/)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={packageForm.amountPaid}
                      onChange={(e) => setPackageForm({ ...packageForm, amountPaid: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    value={packageForm.notes}
                    onChange={(e) => setPackageForm({ ...packageForm, notes: e.target.value })}
                    placeholder="Observaciones..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddPackageOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleAddPackage}>
                  Registrar Pago
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPickupOpen} onOpenChange={setIsPickupOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={credits.filter(c => c.is_active).length === 0}>
              <Minus className="w-4 h-4" />
              Registrar Entrega
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Entrega de Recargas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Paquete de Créditos</Label>
                <Select value={selectedCreditId} onValueChange={setSelectedCreditId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar paquete" />
                  </SelectTrigger>
                  <SelectContent>
                    {credits.filter(c => c.is_active).map((credit) => (
                      <SelectItem key={credit.id} value={credit.id}>
                        {credit.package_name} - {credit.remaining_credits} disponibles
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Producto</Label>
                <Select value={pickupForm.productId} onValueChange={(v) => setPickupForm({ ...pickupForm, productId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {recargaProducts.length > 0 ? (
                      recargaProducts.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stock})
                        </SelectItem>
                      ))
                    ) : (
                      products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stock})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cantidad de Recargas</Label>
                <Input
                  type="number"
                  min="1"
                  value={pickupForm.quantity}
                  onChange={(e) => setPickupForm({ ...pickupForm, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={pickupForm.notes}
                  onChange={(e) => setPickupForm({ ...pickupForm, notes: e.target.value })}
                  placeholder="Observaciones de la entrega..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsPickupOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handlePickup}>
                  Registrar Entrega
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credit Packages List */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Activos</TabsTrigger>
          <TabsTrigger value="all">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {credits.filter(c => c.is_active).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No hay paquetes activos</p>
              </CardContent>
            </Card>
          ) : (
            credits.filter(c => c.is_active).map((credit) => (
              <CreditPackageCard 
                key={credit.id} 
                credit={credit} 
                onDeactivate={() => deactivatePackage(credit.id)}
                formatCurrency={formatCurrency}
                locale={locale}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {credits.map((credit) => (
            <CreditPackageCard 
              key={credit.id} 
              credit={credit} 
              onDeactivate={credit.is_active ? () => deactivatePackage(credit.id) : undefined}
              formatCurrency={formatCurrency}
              locale={locale}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface CreditPackageCardProps {
  credit: any;
  onDeactivate?: () => void;
  formatCurrency: (amount: number) => string;
  locale: any;
}

function CreditPackageCard({ credit, onDeactivate, formatCurrency, locale }: CreditPackageCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { usage, loading } = useCreditUsage(showHistory ? credit.id : undefined);
  
  const usedPercentage = ((credit.total_credits - credit.remaining_credits) / credit.total_credits) * 100;

  return (
    <Card className={!credit.is_active ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{credit.package_name}</h4>
              <Badge variant={credit.is_active ? 'default' : 'secondary'}>
                {credit.is_active ? 'Activo' : 'Completado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(credit.purchase_date), 'PPP', { locale })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{credit.remaining_credits}</p>
            <p className="text-xs text-muted-foreground">de {credit.total_credits}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mb-3">
          <div 
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${usedPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagado: {formatCurrency(Number(credit.amount_paid))}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4 mr-1" />
              Historial
            </Button>
            {onDeactivate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onDeactivate}
              >
                Desactivar
              </Button>
            )}
          </div>
        </div>

        {/* Usage History */}
        {showHistory && (
          <div className="mt-4 border-t pt-4">
            <h5 className="font-medium mb-2">Historial de Entregas</h5>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : usage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Sin entregas registradas
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {usage.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                    <div>
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        -{u.quantity} recargas
                      </span>
                      {u.notes && <p className="text-xs text-muted-foreground">{u.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(u.created_at), 'Pp', { locale })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
