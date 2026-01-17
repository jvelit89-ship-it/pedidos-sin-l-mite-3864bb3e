import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useSync } from '@/contexts/SyncContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Language, Currency, CURRENCY_CONFIG } from '@/types';
import { User, LogOut, RefreshCw, Wifi, WifiOff, Globe, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, isAdmin } = useAuth();
  const { isOnline, syncNow, isSyncing, lastSyncTime } = useSync();
  const { settings, updateSettings, t } = useSettings();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">{t.settingsTitle}</h1>
      
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> {t.account}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">{t.name}</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t.email}</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rol</span><span className="font-medium capitalize">{user?.role}</span></div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> {t.language} & {t.currency}</CardTitle></CardHeader>
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
