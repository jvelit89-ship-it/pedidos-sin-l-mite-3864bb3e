import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

interface EditProductOTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  pendingChanges: Record<string, any>;
  onSuccess: () => void;
}

export function EditProductOTPDialog({
  open,
  onOpenChange,
  productId,
  productName,
  pendingChanges,
  onSuccess,
}: EditProductOTPDialogProps) {
  const { settings } = useSettings();
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendOTP = async () => {
    setIsSendingOtp(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('Sesión no válida');
        return;
      }

      const response = await supabase.functions.invoke('send-product-edit-otp', {
        body: { productId, pendingChanges, productName },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setOtpSent(true);
      toast.success(
        settings.language === 'es' 
          ? 'Código de verificación enviado a tu email' 
          : 'Verification code sent to your email'
      );
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Error al enviar el código');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error(
        settings.language === 'es' 
          ? 'Ingresa el código de 6 dígitos' 
          : 'Enter the 6-digit code'
      );
      return;
    }

    setIsVerifying(true);
    try {
      const response = await supabase.functions.invoke('verify-product-edit-otp', {
        body: { otpCode, productId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(
        settings.language === 'es' 
          ? 'Producto actualizado correctamente' 
          : 'Product updated successfully'
      );
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast.error(error.message || 'Código inválido o expirado');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setOtpCode('');
    setOtpSent(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {settings.language === 'es' ? 'Verificación de Seguridad' : 'Security Verification'}
          </DialogTitle>
          <DialogDescription>
            {settings.language === 'es' 
              ? `Para editar "${productName}", necesitas verificar tu identidad.`
              : `To edit "${productName}", you need to verify your identity.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!otpSent ? (
            <div className="text-center space-y-4">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {settings.language === 'es' 
                  ? 'Te enviaremos un código de verificación a tu email registrado.'
                  : 'We will send a verification code to your registered email.'}
              </p>
              <Button 
                onClick={sendOTP} 
                disabled={isSendingOtp}
                className="w-full"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {settings.language === 'es' ? 'Enviando...' : 'Sending...'}
                  </>
                ) : (
                  settings.language === 'es' ? 'Enviar Código' : 'Send Code'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                {settings.language === 'es' 
                  ? 'Ingresa el código de 6 dígitos enviado a tu email:'
                  : 'Enter the 6-digit code sent to your email:'}
              </p>
              
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOtpSent(false)}
                  className="flex-1"
                  disabled={isVerifying}
                >
                  {settings.language === 'es' ? 'Reenviar' : 'Resend'}
                </Button>
                <Button
                  onClick={verifyOTP}
                  disabled={isVerifying || otpCode.length !== 6}
                  className="flex-1"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {settings.language === 'es' ? 'Verificando...' : 'Verifying...'}
                    </>
                  ) : (
                    settings.language === 'es' ? 'Verificar y Guardar' : 'Verify & Save'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
