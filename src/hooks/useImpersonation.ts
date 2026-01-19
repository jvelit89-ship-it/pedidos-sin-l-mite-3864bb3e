import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ADMIN_SESSION_KEY = 'admin_original_session';
const IMPERSONATION_KEY = 'is_impersonating';

interface StoredSession {
  access_token: string;
  refresh_token: string;
  email: string;
}

export function useImpersonation() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminEmail, setOriginalAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we're currently impersonating
    const impersonating = sessionStorage.getItem(IMPERSONATION_KEY);
    const storedSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
    
    if (impersonating === 'true' && storedSession) {
      setIsImpersonating(true);
      try {
        const parsed: StoredSession = JSON.parse(storedSession);
        setOriginalAdminEmail(parsed.email);
      } catch {
        setOriginalAdminEmail(null);
      }
    }
  }, []);

  const impersonateUser = useCallback(async (targetUserId: string, targetUserName: string) => {
    setLoading(true);
    try {
      // Store current admin session before impersonating
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        toast.error('No hay sesión activa');
        return false;
      }

      // Store admin session for later restoration
      const sessionToStore: StoredSession = {
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
        email: currentSession.user.email || '',
      };
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionToStore));

      // Call the impersonation edge function
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { target_user_id: targetUserId }
      });

      if (error) {
        console.error('Impersonation error:', error);
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        toast.error('Error al ingresar como usuario');
        return false;
      }

      if (data?.session) {
        // Sign out current user locally (do not revoke admin tokens)
        await supabase.auth.signOut({ scope: 'local' });
        
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
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          toast.error('Error al establecer la sesión');
          return false;
        }
        
        toast.success(`Ingresando como ${targetUserName}...`);
        
        // Reload to apply new session
        window.location.href = '/';
        return true;
      }

      toast.error('No se pudo generar el enlace de acceso');
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return false;
    } catch (error) {
      console.error('Impersonation error:', error);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      toast.error('Error al ingresar como usuario');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const returnToAdmin = useCallback(async () => {
    setLoading(true);
    try {
      // Get stored admin session
      const storedSessionStr = sessionStorage.getItem(ADMIN_SESSION_KEY);
      
      if (!storedSessionStr) {
        toast.error('No se encontró la sesión del administrador');
        // Clean up and redirect to login
        sessionStorage.removeItem(IMPERSONATION_KEY);
        await supabase.auth.signOut({ scope: 'local' });
        window.location.href = '/auth';
        return;
      }

      const storedSession: StoredSession = JSON.parse(storedSessionStr);
      
      // Sign out current impersonated user locally
      await supabase.auth.signOut({ scope: 'local' });
      
      // Restore admin session
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token,
      });

      if (setSessionError) {
        console.error('Restore session error:', setSessionError);
        // Session might be expired, redirect to login
        sessionStorage.removeItem(IMPERSONATION_KEY);
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        toast.error('Sesión expirada. Inicia sesión nuevamente.');
        window.location.href = '/auth';
        return;
      }

      // Clean up
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      
      toast.success('Volviendo a tu cuenta de admin...');
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Return to admin error:', error);
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      toast.error('Error al volver a admin');
      window.location.href = '/auth';
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
