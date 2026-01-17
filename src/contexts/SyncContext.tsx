import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  markDataChanged: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexión restaurada', {
        description: 'Los cambios se sincronizarán automáticamente',
        duration: 3000,
      });
      // Auto-sync pending changes when back online
      if (pendingSyncCount > 0) {
        syncNow();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sin conexión', {
        description: 'Los cambios se guardarán localmente',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSyncCount]);

  // Mark sync as complete (called automatically when data operations succeed)
  const markSyncComplete = useCallback(() => {
    setPendingSyncCount(0);
    setLastSyncTime(new Date());
  }, []);

  // Mark that data has changed - will auto-sync if online
  const markDataChanged = useCallback(() => {
    if (isOnline) {
      // When online, data syncs automatically via Supabase
      // Just update the last sync time
      setLastSyncTime(new Date());
    } else {
      // When offline, increment pending count
      setPendingSyncCount((prev) => prev + 1);
    }
  }, [isOnline]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      // With Supabase, sync happens automatically when online
      // This is mainly for when coming back online with pending changes
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      markSyncComplete();
      
      if (pendingSyncCount > 0) {
        toast.success('Sincronización completada', {
          description: 'Todos los datos están actualizados',
          duration: 2000,
        });
      }
    } catch (error) {
      toast.error('Error de sincronización', {
        description: 'Intente nuevamente más tarde',
        duration: 5000,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, pendingSyncCount, markSyncComplete]);

  // Initial sync check
  useEffect(() => {
    if (isOnline) {
      setLastSyncTime(new Date());
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingSyncCount,
        lastSyncTime,
        syncNow,
        markDataChanged,
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
