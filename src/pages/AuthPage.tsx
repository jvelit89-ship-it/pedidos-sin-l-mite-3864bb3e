import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSupabaseAuth } from '@/hooks/useAuth';
import { useAuth, getDefaultRoute } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { handleError } from '@/lib/error-handler';

import { z } from 'zod';
import { Loader2, LogIn, Mail, Package } from 'lucide-react';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, loading: authLoading } = useSupabaseAuth();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Check if returning from impersonation
  const [returningFromImpersonation, setReturningFromImpersonation] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Forgot password state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Check for impersonation return on mount
  useEffect(() => {
    const wasImpersonating = sessionStorage.getItem('returning_from_impersonation');
    const savedAdminEmail = sessionStorage.getItem('admin_email');
    
    if (wasImpersonating === 'true' && savedAdminEmail) {
      setReturningFromImpersonation(true);
      setAdminEmail(savedAdminEmail);
      setFormData(prev => ({ ...prev, email: savedAdminEmail }));
      
      // Clean up
      sessionStorage.removeItem('returning_from_impersonation');
      sessionStorage.removeItem('admin_email');
      sessionStorage.removeItem('is_impersonating');
      
      toast.info('Sesión de impersonación finalizada', {
        description: 'Ingresa tu contraseña para volver a tu cuenta de admin.',
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading && user) {
      navigate(getDefaultRoute(user.role));
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const result = authSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      const { error } = await signIn(formData.email, formData.password);
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast.error('Credenciales incorrectas');
        } else {
          handleError(error, { context: 'Inicio de Sesión' });
        }
      } else {

        toast.success('Bienvenido');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Ingresa tu correo electrónico');
      return;
    }

    // Validate email format
    const emailValidation = z.string().email().safeParse(resetEmail);
    if (!emailValidation.success) {
      toast.error('Ingresa un correo electrónico válido');
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        handleError(error, { context: 'Restablecer Contraseña' });
      } else {

        toast.success('Correo enviado', {
          description: 'Revisa tu bandeja de entrada para restablecer tu contraseña. El enlace expira en 1 hora.',
        });
        setIsForgotPasswordOpen(false);
        setResetEmail('');
      }
    } catch (error) {
      toast.error('Error de conexión', {
        description: 'Intenta nuevamente',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      {/* Logo and Title */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#3b82f6] flex items-center justify-center shadow-lg mb-3">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-foreground text-center">Sistema de Pedidos y Entregas</h1>
        <p className="text-sm text-muted-foreground">en Tiempo Real</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {returningFromImpersonation ? 'Volver a Admin' : 'Iniciar Sesión'}
          </CardTitle>
          <CardDescription>
            {returningFromImpersonation 
              ? `Ingresa la contraseña de ${adminEmail}`
              : 'Ingresa tus credenciales para continuar'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@email.com"
                disabled={loading}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••"
                disabled={loading}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-4 flex justify-center">
            <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restablecer Contraseña</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Correo Electrónico</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={isSendingReset}
                    />
                    <p className="text-xs text-muted-foreground">
                      Te enviaremos un enlace para restablecer tu contraseña
                    </p>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={isSendingReset}>
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Enviar Enlace
                      </>
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-[10px] text-muted-foreground">
        Version 1.31190126 - Creado por Juan Manuel Velit
      </p>
    </div>
  );
}