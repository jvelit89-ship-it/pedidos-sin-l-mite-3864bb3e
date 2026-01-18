import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

  const handleDownloadHTML = () => {
    if (!html) return;
    
    // Create a complete HTML document with print styles optimized for 80mm thermal printer
    const fullHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nota de Venta ${noteNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      body {
        width: 80mm;
        margin: 0;
        padding: 2mm;
      }
    }
    body {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 2mm;
      font-family: 'Courier New', monospace;
      background: white;
      color: black;
    }
    * {
      color: black !important;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
    
    const blob = new Blob([fullHtmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-venta-${noteNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('HTML descargado - Abrir e imprimir como PDF');
  };

  // Create print-optimized HTML for the iframe
  const printOptimizedHtml = html ? `
    <html>
      <head>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body {
              width: 80mm;
              margin: 0;
              padding: 2mm;
            }
          }
          body {
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  ` : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
        <div className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nota de Venta {noteNumber}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden bg-muted/50 p-2">
          {printOptimizedHtml ? (
            <iframe
              ref={iframeRef}
              srcDoc={printOptimizedHtml}
              className="w-full h-[60vh] bg-white border rounded shadow-sm"
              title="Vista previa de nota de venta"
            />
          ) : (
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="p-4 border-t space-y-2 shrink-0">
          <div className="flex gap-2">
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
          </div>
          <Button 
            onClick={handleDownloadHTML} 
            variant="outline"
            className="w-full gap-2"
            disabled={!html}
          >
            <Download className="w-4 h-4" />
            Descargar HTML
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Tip: Para PDF, usa "Imprimir" y selecciona "Guardar como PDF"
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
