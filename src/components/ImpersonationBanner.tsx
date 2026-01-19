import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogOut } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, originalAdminEmail, returnToAdmin, loading } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
      <AlertCircle className="h-4 w-4" />
      <span>
        Estás viendo la app como otro usuario
        {originalAdminEmail && ` (Admin: ${originalAdminEmail})`}
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900"
        onClick={returnToAdmin}
        disabled={loading}
      >
        <LogOut className="h-3 w-3 mr-1" />
        Volver a Admin
      </Button>
    </div>
  );
}
