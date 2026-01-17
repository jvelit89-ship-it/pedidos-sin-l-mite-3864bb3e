import { useSync } from '@/contexts/SyncContext';
import { WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingSyncCount } = useSync();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-white overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>Sin conexión — Trabajando en modo offline</span>
            {pendingSyncCount > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {pendingSyncCount} pendientes
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingSyncCount, syncNow, lastSyncTime } = useSync();

  if (!isOnline) {
    return (
      <button
        onClick={syncNow}
        disabled
        className="flex items-center gap-1.5 text-amber-500"
        title="Sin conexión a internet"
      >
        <CloudOff className="w-4 h-4" />
        <span className="text-xs font-medium">Offline</span>
        {pendingSyncCount > 0 && (
          <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-xs">
            {pendingSyncCount}
          </span>
        )}
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 text-primary">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs font-medium">Sincronizando...</span>
      </div>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <button
        onClick={syncNow}
        className="flex items-center gap-1.5 text-amber-500 hover:text-amber-600 transition-colors"
        title="Sincronizar cambios pendientes"
      >
        <RefreshCw className="w-4 h-4" />
        <span className="text-xs font-medium">{pendingSyncCount} pendientes</span>
      </button>
    );
  }

  return (
    <div 
      className="flex items-center gap-1.5 text-green-500"
      title={lastSyncTime ? `Última sincronización: ${lastSyncTime.toLocaleTimeString()}` : 'Sincronizado'}
    >
      <Cloud className="w-4 h-4" />
      <span className="text-xs font-medium">Auto-sync</span>
    </div>
  );
}

interface SyncStatusBadgeProps {
  status: 'synced' | 'pending' | 'error';
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const config = {
    synced: { icon: Cloud, className: 'sync-synced', label: 'Sincronizado' },
    pending: { icon: RefreshCw, className: 'sync-pending', label: 'Pendiente' },
    error: { icon: CloudOff, className: 'sync-offline', label: 'Error' },
  };

  const { icon: Icon, className, label } = config[status];

  return (
    <div className={`flex items-center gap-1 ${className}`} title={label}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}
