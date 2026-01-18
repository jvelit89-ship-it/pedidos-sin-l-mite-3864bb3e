import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useOperarios, useUpdateTeamMemberPassword } from '@/hooks/useTeam';
import { toast } from 'sonner';
import { Plus, Search, Wrench, Phone, Mail, Edit2, Trash2, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateSecurePassword } from '@/lib/passwordGenerator';

export default function OperariosPage() {
  const { isAdmin } = useAuth();
  const { t } = useSettings();
  const { operarios, loading, createOperario, updateOperario, deleteOperario } = useOperarios();
  const { updatePassword: updateTeamMemberPassword } = useUpdateTeamMemberPassword();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOperario, setSelectedOperario] = useState<typeof operarios[0] | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedOperario) {
        await updateOperario(selectedOperario.id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          active: formData.active,
        });
        
        if (formData.password && selectedOperario.user_id) {
          const success = await updateTeamMemberPassword(selectedOperario.user_id, formData.password);
          if (success) {
            toast.success('Contraseña actualizada');
          }
        } else if (formData.password && !selectedOperario.user_id) {
          toast.warning('Este operario no tiene cuenta de usuario vinculada.');
        }
      } else {
        if (!formData.password) {
          toast.error('La contraseña es requerida');
          setIsSubmitting(false);
          return;
        }
        await createOperario({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          active: formData.active,
        });
      }
      handleCloseDialog();
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteOperario(id);
      toast.success(`${name} eliminado`);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedOperario(null);
    setFormData({ name: '', email: '', phone: '', password: '', active: true });
    setShowPassword(false);
  };

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword();
    setFormData({ ...formData, password: newPassword });
    setShowPassword(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(formData.password);
    toast.success('Contraseña copiada');
  };

  const handleEdit = (operario: typeof operarios[0]) => {
    setSelectedOperario(operario);
    setFormData({
      name: operario.name,
      email: operario.email || '',
      phone: operario.phone || '',
      password: '',
      active: operario.active ?? true,
    });
    setIsDialogOpen(true);
  };

  const filtered = operarios.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
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
        <h1 className="text-2xl font-bold">Operarios</h1>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) handleCloseDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo Operario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedOperario ? 'Editar Operario' : 'Nuevo Operario'}
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
              <div className="space-y-2">
                <Label>{selectedOperario ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!selectedOperario}
                      minLength={8}
                      placeholder={selectedOperario ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={handleGeneratePassword} title="Generar contraseña segura">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  {formData.password && (
                    <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword} title="Copiar contraseña">
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedOperario ? 'Ingresa una nueva contraseña solo si deseas cambiarla' : 'Usa el botón de refrescar para generar una contraseña segura'}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>{t.active}</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : selectedOperario ? t.save : t.create}
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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="card-interactive">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{o.name}</p>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            o.active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {o.active ? t.active : t.inactive}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate">{o.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" />
                          {o.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(o)}>
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
                            <AlertDialogTitle>¿Eliminar operario?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará {o.name} permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(o.id, o.name)}>
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