import { lazy, ReactNode, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDefaultRoute } from '@/contexts/AuthContext';
import { OfflineBanner } from '@/components/SyncIndicator';
import { AppFooter } from '@/components/AppFooter';
import { Loader2 } from 'lucide-react';

const DesktopSidebar = lazy(() =>
  import('@/components/Navigation').then((module) => ({ default: module.DesktopSidebar }))
);
const BottomNavigation = lazy(() =>
  import('@/components/Navigation').then((module) => ({ default: module.BottomNavigation }))
);
const ImpersonationBanner = lazy(() =>
  import('@/components/ImpersonationBanner').then((module) => ({ default: module.ImpersonationBanner }))
);
const RepartidorBlockOverlay = lazy(() =>
  import('@/components/RepartidorBlockOverlay').then((module) => ({ default: module.RepartidorBlockOverlay }))
);

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Check if impersonating to add top padding
  const isImpersonating = sessionStorage.getItem('is_impersonating') === 'true';

  return (
    <div className={`min-h-screen bg-background ${isImpersonating ? 'pt-10' : ''}`}>
      {isImpersonating && (
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
      )}
      <OfflineBanner />
      {user.role === 'repartidor' && (
        <Suspense fallback={null}>
          <RepartidorBlockOverlay />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <DesktopSidebar />
      </Suspense>
      <main className="md:ml-64 pb-safe md:pb-0">
        <div className="min-h-screen pb-8">
          {children}
        </div>
      </main>
      <Suspense fallback={null}>
        <BottomNavigation />
      </Suspense>
      <AppFooter />
    </div>
  );
}
