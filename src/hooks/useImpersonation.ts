import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ADMIN_SESSION_KEY = 'admin_original_session';
const IMPERSONATION_KEY = 'is_impersonating';

export function useImpersonation() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminEmail, setOriginalAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we're currently impersonating
    const impersonating = sessionStorage.getItem(IMPERSONATION_KEY);
    const adminEmail = sessionStorage.getItem('admin_email');
    if (impersonating === 'true') {
      setIsImpersonating(true);
      setOriginalAdminEmail(adminEmail);
    }
  }, []);

  const impersonateUser = useCallback(async (targetUserId: string, targetUserName: string) => {
    setLoading(true);
    try {
      // Store current session info before impersonating
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        sessionStorage.setItem('admin_email', currentSession.user.email || '');
      }

      // Call the impersonation edge function
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { target_user_id: targetUserId }
      });

      if (error) {
        console.error('Impersonation error:', error);
        toast.error('Error al ingresar como usuario');
        return false;
      }

      if (data?.session) {
        // Sign out current user first
        await supabase.auth.signOut();
        
        // Mark that we're impersonating
        sessionStorage.setItem(IMPERSONATION_KEY, 'true');
        
        // Set the new session directly
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (setSessionError) {
          console.error('Set session error:', setSessionError);
          sessionStorage.removeItem(IMPERSONATION_KEY);
          sessionStorage.removeItem('admin_email');
          toast.error('Error al establecer la sesión');
          return false;
        }
        
        toast.success(`Ingresando como ${targetUserName}...`);
        
        // Reload to apply new session
        window.location.href = '/';
        return true;
      }

      toast.error('No se pudo generar el enlace de acceso');
      return false;
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error('Error al ingresar como usuario');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const returnToAdmin = useCallback(async () => {
    setLoading(true);
    try {
      // Clear impersonation flag
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem('admin_email');
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      
      toast.info('Sesión cerrada. Inicia sesión como administrador.');
      window.location.href = '/auth';
    } catch (error) {
      console.error('Return to admin error:', error);
      toast.error('Error al volver a admin');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isImpersonating,
    originalAdminEmail,
    impersonateUser,
    returnToAdmin,
    loading,
  };
}
