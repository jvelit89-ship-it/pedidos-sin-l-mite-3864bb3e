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
import { Loader2, Mail, PackageCheck, KeyRound } from 'lucide-react';

interface MarkDeliveredOTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderIds: string[];
  onSuccess: () => void;
}

export function MarkDeliveredOTPDialog({
  open,
  onOpenChange,
  orderIds,
  onSuccess,
}: MarkDeliveredOTPDialogProps) {
  const [step, setStep] = useState<'request' | 'otp'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setStep('request');
    setOtpCode('');
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-mark-delivered-otp', {
        body: { orderIds },
      });
      if (error) {
        toast.error('No se pudo enviar el código');
        return;
      }
      toast.success('Código enviado a tu correo');
      setStep('otp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-mark-delivered-otp', {
        body: { otpCode, orderIds },
      });
      if (error || !data?.success) {
        toast.error('Código inválido o expirado');
        return;
      }
      toast.success(`${orderIds.length} pedido(s) marcado(s) como entregado(s)`);
      onSuccess();
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); else onOpenChange(val); }}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 'request' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-green-600" />
                Confirmar Entrega
              </DialogTitle>
              <DialogDescription>
                Para marcar {orderIds.length} pedido(s) como entregado(s), enviaremos un código de verificación a tu correo.
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
                <KeyRound className="w-5 h-5 text-primary" />
                Ingresar Código
              </DialogTitle>
              <DialogDescription>
                Ingresa el código de 6 dígitos enviado a tu correo para confirmar la entrega.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
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
              <Button onClick={handleVerify} disabled={otpCode.length !== 6 || isLoading} className="gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar Entrega
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
