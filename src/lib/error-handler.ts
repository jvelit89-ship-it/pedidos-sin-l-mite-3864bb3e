import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ErrorOptions {
  silent?: boolean;
  showToast?: boolean;
  logToDatabase?: boolean;
  context?: string;
  details?: any;
}

export const handleError = async (error: any, options: ErrorOptions = {}) => {
  const { 
    silent = false, 
    showToast = true, 
    logToDatabase = true, 
    context = 'App',
    details = null 
  } = options;

  const errorMessage = error?.message || error?.error_description || 'Ocurrió un error inesperado';
  const errorTitle = context ? `Error en ${context}` : 'Error';

  // Always log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${errorTitle}]:`, error, details);
  }

  // Show toast to user
  if (showToast && !silent) {
    toast.error(errorMessage, {
      description: context,
    });
  }

  // Log to database if needed and user is authenticated
  if (logToDatabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // We use the 'logs' table as found in the database
        await supabase.from('logs').insert({
          action: 'ERROR',
          entity: context,
          details: {
            message: errorMessage,
            stack: error?.stack,
            originalError: typeof error === 'object' ? JSON.stringify(error) : error,
            additionalDetails: details,
            url: window.location.href,
          },
          user_id: user.id
        });
      }
    } catch (e) {
      console.error('Failed to log error to database:', e);
    }
  }

  return { message: errorMessage, error };
};
