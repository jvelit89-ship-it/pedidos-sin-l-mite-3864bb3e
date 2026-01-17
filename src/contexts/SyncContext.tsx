import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexión restaurada', {
        description: 'Sincronizando datos...',
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sin conexión', {
        description: 'Trabajando en modo offline',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingSyncCount]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      // Simulate sync delay (in real app, this would sync with backend)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      setPendingSyncCount(0);
      setLastSyncTime(new Date());
      
      toast.success('Sincronización completada', {
        description: 'Todos los datos están actualizados',
        duration: 3000,
      });
    } catch (error) {
      toast.error('Error de sincronización', {
        description: 'Intente nuevamente más tarde',
        duration: 5000,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  const incrementPendingSync = useCallback(() => {
    setPendingSyncCount((prev) => prev + 1);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingSyncCount,
        lastSyncTime,
        syncNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
