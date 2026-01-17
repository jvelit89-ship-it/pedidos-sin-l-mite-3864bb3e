import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useSync } from '@/contexts/SyncContext';
import { User, LogOut, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { isOnline, syncNow, isSyncing, lastSyncTime } = useSync();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Cuenta</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rol</span><span className="font-medium capitalize">{user?.role === 'vendedor' ? 'Vendedor' : user?.role === 'repartidor' ? 'Repartidor' : 'Administrador'}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">{isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />} Sincronización</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estado</span>
            <SyncIndicator />
          </div>
          {lastSyncTime && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Última sync</span><span>{lastSyncTime.toLocaleTimeString()}</span></div>}
          <Button variant="outline" className="w-full gap-2" onClick={syncNow} disabled={!isOnline || isSyncing}>
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar Ahora
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full gap-2" onClick={handleLogout}>
        <LogOut className="w-4 h-4" /> Cerrar Sesión
      </Button>
    </div>
  );
}
