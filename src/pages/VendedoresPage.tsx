import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { getAllItems, addItem, updateItem, deleteItem } from '@/lib/db';
import { Vendedor } from '@/types';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Search, UserCheck, Phone, Mail, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

export default function VendedoresPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useSettings();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    active: true,
  });

  useEffect(() => {
    loadVendedores();
  }, []);

  const loadVendedores = async () => {
    setIsLoading(true);
    const data = await getAllItems('vendedores');
    setVendedores(data.sort((a, b) => a.name.localeCompare(b.name)));
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    if (selectedVendedor) {
      await updateItem('vendedores', {
        ...selectedVendedor,
        ...formData,
      });
      toast.success('Vendedor actualizado');
    } else {
      await addItem('vendedores', {
        id: uuidv4(),
        ...formData,
        companyId: user?.companyId,
        createdAt: now,
      });
      toast.success('Vendedor creado');
    }

    await loadVendedores();
    handleCloseDialog();
  };

  const handleDelete = async (vendedor: Vendedor) => {
    await deleteItem('vendedores', vendedor.id);
    toast.success('Vendedor eliminado');
    await loadVendedores();
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedVendedor(null);
    setFormData({ name: '', email: '', phone: '', active: true });
  };

  const handleEdit = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setFormData({
      name: vendedor.name,
      email: vendedor.email,
      phone: vendedor.phone,
      active: vendedor.active,
    });
    setIsDialogOpen(true);
  };

  const filtered = vendedores.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes acceso a esta sección</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t.vendedores}</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> {t.newVendedor}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedVendedor ? t.editVendedor : t.newVendedor}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.name} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.email} *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.phone} *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t.active}</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
              <Button type="submit" className="w-full">
                {selectedVendedor ? t.save : t.create}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`${t.search}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="card-interactive">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{v.name}</p>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            v.active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {v.active ? t.active : t.inactive}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate">{v.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" />
                          {v.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar vendedor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará {v.name} permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(v)}>
                              {t.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
