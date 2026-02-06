import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useSuppliers, Supplier, SupplierFormData } from '@/hooks/useSuppliers';
import { 
  Plus, 
  Search, 
  Pencil,
  Building2,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function SuppliersPage() {
  const { 
    suppliers, 
    allSuppliers,
    loadingSuppliers, 
    createSupplier,
    updateSupplier,
    toggleSupplierStatus,
    checkSupplierHasPurchases,
    isCreating,
    isUpdating,
  } = useSuppliers();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    business_name: '',
    document_type: 'ruc',
    ruc: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    contact_name: '',
    notes: '',
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayedSuppliers = showInactive ? allSuppliers : suppliers;
  
  const filteredSuppliers = displayedSuppliers.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(searchLower) ||
      s.business_name?.toLowerCase().includes(searchLower) ||
      s.ruc?.toLowerCase().includes(searchLower) ||
      s.email?.toLowerCase().includes(searchLower)
    );
  });

  const resetForm = () => {
    setFormData({
      name: '',
      business_name: '',
      document_type: 'ruc',
      ruc: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      contact_name: '',
      notes: '',
      is_active: true,
    });
    setErrors({});
    setEditingSupplier(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      business_name: supplier.business_name || '',
      document_type: supplier.document_type || 'ruc',
      ruc: supplier.ruc || '',
      address: supplier.address || '',
      city: supplier.city || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      contact_name: supplier.contact_name || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active,
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    if (supplier.is_active) {
      // Check if has purchases before deactivating
      const hasPurchases = await checkSupplierHasPurchases(supplier.id);
      if (hasPurchases) {
        setSelectedSupplier(supplier);
        setStatusDialogOpen(true);
        return;
      }
    }
    await toggleSupplierStatus(supplier.id, !supplier.is_active);
  };

  const confirmToggleStatus = async () => {
    if (selectedSupplier) {
      await toggleSupplierStatus(selectedSupplier.id, !selectedSupplier.is_active);
      setStatusDialogOpen(false);
      setSelectedSupplier(null);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'La razón social es obligatoria';
    }
    if (!formData.ruc?.trim()) {
      newErrors.ruc = 'El documento es obligatorio';
    } else if (formData.document_type === 'ruc' && formData.ruc.length !== 11) {
      newErrors.ruc = 'El RUC debe tener 11 dígitos';
    } else if (formData.document_type === 'dni' && formData.ruc.length !== 8) {
      newErrors.ruc = 'El DNI debe tener 8 dígitos';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
      } else {
        await createSupplier(formData);
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const stats = {
    total: allSuppliers.length,
    active: suppliers.length,
    inactive: allSuppliers.length - suppliers.length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
          <p className="text-muted-foreground">Gestión de proveedores del sistema</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Inactivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <CardTitle className="flex-1">Listado de Proveedores</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="show-inactive" className="text-sm">
                  Mostrar inactivos
                </Label>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSuppliers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay proveedores registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          {supplier.business_name && (
                            <p className="text-sm text-muted-foreground">{supplier.business_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">
                            {supplier.document_type || 'RUC'}
                          </p>
                          <p>{supplier.ruc || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>
                        {supplier.is_active ? (
                          <Badge variant="secondary" className="text-primary">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(supplier)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(supplier)}
                            className={supplier.is_active ? "text-destructive hover:text-destructive" : "text-primary hover:text-primary"}
                          >
                            {supplier.is_active ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Razón Social */}
              <div className="space-y-2">
                <Label>Razón Social *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre legal de la empresa"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              {/* Nombre Comercial */}
              <div className="space-y-2">
                <Label>Nombre Comercial</Label>
                <Input
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  placeholder="Nombre comercial (opcional)"
                />
              </div>

              {/* Tipo Documento */}
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select 
                  value={formData.document_type} 
                  onValueChange={(v) => setFormData({ ...formData, document_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ruc">RUC</SelectItem>
                    <SelectItem value="dni">DNI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Documento */}
              <div className="space-y-2">
                <Label>{formData.document_type === 'ruc' ? 'RUC' : 'DNI'} *</Label>
                <Input
                  value={formData.ruc}
                  onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '') })}
                  placeholder={formData.document_type === 'ruc' ? "20123456789" : "12345678"}
                  maxLength={formData.document_type === 'ruc' ? 11 : 8}
                  className={errors.ruc ? "border-destructive" : ""}
                />
                {errors.ruc && <p className="text-sm text-destructive">{errors.ruc}</p>}
              </div>

              {/* Dirección */}
              <div className="space-y-2 md:col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Dirección del proveedor"
                />
              </div>

              {/* Ciudad */}
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ciudad"
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="999 999 999"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="proveedor@email.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Contacto */}
              <div className="space-y-2">
                <Label>Persona de Contacto</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Nombre del contacto"
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-2 md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>

              {/* Estado */}
              {editingSupplier && (
                <div className="flex items-center gap-3 md:col-span-2">
                  <Switch
                    id="is-active"
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label htmlFor="is-active">Proveedor activo</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isCreating || isUpdating}
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Este proveedor tiene compras asociadas. Al desactivarlo, no podrá ser 
              seleccionado en nuevas compras, pero el historial se mantendrá intacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus}>
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
