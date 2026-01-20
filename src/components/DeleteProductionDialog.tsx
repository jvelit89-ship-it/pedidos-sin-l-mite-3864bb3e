import { useEffect, useState } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Trash2, AlertTriangle, Mail } from 'lucide-react';

interface DeleteProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionIds: string[];
  deleteAll?: boolean;
  onSuccess: () => void;
  language?: 'es' | 'en';
}

export function DeleteProductionDialog({
  open,
  onOpenChange,
  productionIds,
  deleteAll = false,
  onSuccess,
  language = 'es',
}: DeleteProductionDialogProps) {
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Always reset internal state when the dialog closes (e.g. click outside / ESC)
  useEffect(() => {
    if (!open) {
      setStep('confirm');
      setOtpCode('');
      setIsLoading(false);
    }
  }, [open]);

  const t = {
    es: {
      confirmTitle: '¿Eliminar historial de producción?',
      confirmDescSingle: `¿Estás seguro de que deseas eliminar ${productionIds.length} registro(s) de producción?`,
      confirmDescAll: '¿Estás seguro de que deseas eliminar TODO el historial de producción?',
      confirmWarning: 'Esta acción no se puede deshacer. Se eliminarán los registros y se revertirá el stock asociado.',
      cancel: 'Cancelar',
      continue: 'Continuar',
      otpTitle: 'Verificación por email',
      otpDesc: 'Hemos enviado un código de 6 dígitos a tu correo electrónico. Ingresa el código para confirmar la eliminación.',
      verify: 'Verificar y Eliminar',
      sendingOtp: 'Enviando código...',
      verifying: 'Verificando...',
      otpSent: 'Código enviado a tu email',
      otpError: 'Error al enviar código',
      verifyError: 'Código inválido o expirado',
      deleteSuccess: 'Registros de producción eliminados',
    },
    en: {
      confirmTitle: 'Delete production history?',
      confirmDescSingle: `Are you sure you want to delete ${productionIds.length} production record(s)?`,
      confirmDescAll: 'Are you sure you want to delete ALL production history?',
      confirmWarning: 'This action cannot be undone. Records will be deleted and associated stock will be reverted.',
      cancel: 'Cancel',
      continue: 'Continue',
      otpTitle: 'Email verification',
      otpDesc: 'We have sent a 6-digit code to your email. Enter the code to confirm deletion.',
      verify: 'Verify and Delete',
      sendingOtp: 'Sending code...',
      verifying: 'Verifying...',
      otpSent: 'Code sent to your email',
      otpError: 'Error sending code',
      verifyError: 'Invalid or expired code',
      deleteSuccess: 'Production records deleted',
    },
  };

  const texts = t[language];

  const handleClose = () => {
    setStep('confirm');
    setOtpCode('');
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleSendOtp = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('No session found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-production-delete-otp', {
        body: { productionIds, deleteAll },
      });

      if (error) {
        console.error('Error sending OTP:', error);
        toast.error(texts.otpError);
        return;
      }

      toast.success(texts.otpSent);
      setStep('otp');
    } catch (error) {
      console.error('Error:', error);
      toast.error(texts.otpError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-production-delete-otp', {
        body: { otpCode },
      });

      if (error) {
        console.error('Error verifying OTP:', error);
        toast.error(texts.verifyError);
        return;
      }

      if (data?.success) {
        toast.success(`${texts.deleteSuccess} (${data.deletedCount})`);
        onSuccess();
        handleClose();
      } else {
        toast.error(texts.verifyError);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(texts.verifyError);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'confirm') {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {texts.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{deleteAll ? texts.confirmDescAll : texts.confirmDescSingle}</p>
              <p className="text-destructive font-medium">{texts.confirmWarning}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>{texts.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendOtp}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {texts.sendingOtp}
                </>
              ) : (
                texts.continue
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {texts.otpTitle}
          </DialogTitle>
          <DialogDescription>{texts.otpDesc}</DialogDescription>
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
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {texts.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleVerifyOtp}
            disabled={otpCode.length !== 6 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {texts.verifying}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {texts.verify}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
