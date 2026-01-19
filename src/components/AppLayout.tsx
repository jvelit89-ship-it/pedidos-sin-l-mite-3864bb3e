import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDefaultRoute } from '@/contexts/AuthContext';
import { DesktopSidebar, BottomNavigation } from '@/components/Navigation';
import { OfflineBanner } from '@/components/SyncIndicator';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AppFooter } from '@/components/AppFooter';
import { Loader2 } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <OfflineBanner />
      <DesktopSidebar />
      <main className="md:ml-64 pb-safe md:pb-0">
        <div className="min-h-screen pb-8">
          {children}
        </div>
      </main>
      <BottomNavigation />
      <AppFooter />
    </div>
  );
}
