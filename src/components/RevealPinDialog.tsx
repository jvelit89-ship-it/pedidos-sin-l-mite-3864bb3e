import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Mail, Key } from 'lucide-react';

interface RevealPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess: (pin: string) => void;
}

export function RevealPinDialog({
  open,
  onOpenChange,
  orderId,
  onSuccess,
}: RevealPinDialogProps) {
  const [step, setStep] = useState<'request' | 'otp' | 'revealed'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);

  const handleClose = () => {
    setStep('request');
    setOtpCode('');
    setRevealedPin(null);
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-reveal-pin-otp', {
        body: { orderId },
      });

      if (error) {
        console.error('Error sending OTP:', error);
        toast.error('Error al enviar código OTP');
        return;
      }

      toast.success('Código de verificación enviado a tu email');
      setStep('otp');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar código OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-reveal-pin-otp', {
        body: { otpCode },
      });

      if (error) {
        console.error('Error verifying OTP:', error);
        toast.error('Código inválido o expirado');
        return;
      }

      if (data?.success && data.deliveryPin) {
        setRevealedPin(data.deliveryPin);
        setStep('revealed');
        onSuccess(data.deliveryPin);
      } else {
        toast.error('Error al verificar el código');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al verificar el código');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleClose();
      else onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md">
        {step === 'request' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Verificación de Seguridad
              </DialogTitle>
              <DialogDescription>
                Esta acción es solo para Administradores y Superadmins. Se enviará un código de verificación a tu correo registrado para poder ver el PIN del pedido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSendOtp} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Enviar código por email
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'otp' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Ingresar Código
              </DialogTitle>
              <DialogDescription>
                Hemos enviado un código de 6 dígitos a tu correo. Ingrésalo para revelar el PIN.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('request')}>Volver</Button>
              <Button
                onClick={handleVerifyOtp}
                disabled={otpCode.length !== 6 || isLoading}
                className="gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verificar y Revelar PIN
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'revealed' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="w-5 h-5" />
                PIN Revelado
              </DialogTitle>
              <DialogDescription>
                El PIN de entrega para el pedido #{orderId.slice(0, 8)} es:
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-8">
              <div className="text-5xl font-bold tracking-[0.5em] text-primary bg-primary/5 p-6 rounded-2xl border-2 border-primary/20">
                {revealedPin}
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
