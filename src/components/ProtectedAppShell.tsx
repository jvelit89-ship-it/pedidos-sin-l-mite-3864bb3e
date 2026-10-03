import { Outlet } from 'react-router-dom';
import { SyncProvider } from '@/contexts/SyncContext';
import { AppLayout } from '@/components/AppLayout';

export default function ProtectedAppShell() {
  return (
    <SyncProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </SyncProvider>
  );
}
