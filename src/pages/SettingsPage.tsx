import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useSync } from '@/contexts/SyncContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useUpdateOwnPassword } from '@/hooks/useTeam';
import { generateSecurePassword } from '@/lib/passwordGenerator';
import { Language, Currency, Timezone, CURRENCY_CONFIG, TIMEZONE_CONFIG } from '@/types';
import { User, LogOut, RefreshCw, Wifi, WifiOff, Globe, DollarSign, Key, Eye, EyeOff, Copy, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, logout, isAdmin } = useAuth();
  const { isOnline, syncNow, isSyncing, lastSyncTime } = useSync();
  const { settings, updateSettings, t } = useSettings();
  const { updateOwnPassword } = useUpdateOwnPassword();
  const navigate = useNavigate();

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleGeneratePassword = () => {
    const password = generateSecurePassword();
    setNewPassword(password);
    setShowPassword(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    toast.success('Contraseña copiada');
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const success = await updateOwnPassword(newPassword);
      if (success) {
        setIsPasswordDialogOpen(false);
        setNewPassword('');
        setShowPassword(false);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">{t.settingsTitle}</h1>
      
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> {t.account}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">{t.name}</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t.email}</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rol</span><span className="font-medium capitalize">{user?.role === 'superadmin' ? 'Admin' : user?.role}</span></div>
          
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 mt-4">
                <Key className="w-4 h-4" /> Cambiar Contraseña
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambiar Contraseña</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nueva Contraseña</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        placeholder="Mínimo 8 caracteres"
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
                    {newPassword && (
                      <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword} title="Copiar contraseña">
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usa el botón de refrescar para generar una contraseña segura
                  </p>
                </div>
                <Button 
                  onClick={handleUpdatePassword} 
                  className="w-full" 
                  disabled={isUpdatingPassword || newPassword.length < 8}
                >
                  {isUpdatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> {t.language}, {t.currency} & Zona Horaria</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t.language}</label>
              <Select value={settings.language} onValueChange={(v) => updateSettings({ language: v as Language })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">🇲🇽 Español</SelectItem>
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t.currency}</label>
              <Select value={settings.currency} onValueChange={(v) => updateSettings({ currency: v as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCY_CONFIG).map(([key, { symbol, name }]) => (
                    <SelectItem key={key} value={key}>{symbol} {name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" /> Zona Horaria
              </label>
              <Select value={settings.timezone} onValueChange={(v) => updateSettings({ timezone: v as Timezone })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIMEZONE_CONFIG).map(([key, { label, offset }]) => (
                    <SelectItem key={key} value={key}>🕐 {label} ({offset})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta configuración afecta cómo se muestran las fechas y horas en toda la aplicación
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">{isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />} {t.synchronization}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">{t.status}</span><SyncIndicator /></div>
          {lastSyncTime && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t.lastSync}</span><span>{lastSyncTime.toLocaleTimeString()}</span></div>}
          <Button variant="outline" className="w-full gap-2" onClick={syncNow} disabled={!isOnline || isSyncing}>
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> {t.syncNow}
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full gap-2" onClick={handleLogout}><LogOut className="w-4 h-4" /> {t.logout}</Button>
    </div>
  );
}
