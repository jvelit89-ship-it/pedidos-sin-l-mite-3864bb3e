import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface SalesNotePrintProps {
  html: string | null;
  noteNumber: string;
  open: boolean;
  onClose: () => void;
}

export function SalesNotePrint({ html, noteNumber, open, onClose }: SalesNotePrintProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!iframeRef.current) return;
    
    setIsPrinting(true);
    try {
      const iframeWindow = iframeRef.current.contentWindow;
      if (iframeWindow) {
        iframeWindow.focus();
        iframeWindow.print();
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('Error al imprimir');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    if (!html) return;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-venta-${noteNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Nota de venta descargada');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Nota de Venta {noteNumber}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden bg-muted/50 p-2">
          {html ? (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full h-[60vh] bg-white border rounded shadow-sm"
              title="Vista previa de nota de venta"
            />
          ) : (
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex gap-2 shrink-0">
          <Button 
            onClick={handlePrint} 
            className="flex-1 gap-2"
            disabled={!html || isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            Imprimir (80mm)
          </Button>
          <Button 
            onClick={handleDownload} 
            variant="outline"
            className="gap-2"
            disabled={!html}
          >
            <Download className="w-4 h-4" />
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
