import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Loader2, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';

interface SalesNotePrintProps {
  html: string | null;
  noteNumber: string;
  open: boolean;
  onClose: () => void;
}

export function SalesNotePrint({ html, noteNumber, open, onClose }: SalesNotePrintProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownloadPDF = async () => {
    if (!html) return;
    
    setIsDownloading(true);
    try {
      // Crear un contenedor temporal optimizado para 80mm
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.width = '80mm';
      container.style.maxWidth = '80mm';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Esperar a que las imágenes carguen
      await new Promise(resolve => setTimeout(resolve, 100));

      const options = {
        margin: 0,
        filename: `nota-venta-${noteNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 3, // Mayor escala para mejor calidad
          useCORS: true,
          logging: false,
          width: 302, // 80mm en pixeles (80 * 3.78)
          windowWidth: 302,
        },
        jsPDF: { 
          unit: 'mm', 
          format: [80, 297] as [number, number], // 80mm de ancho para ticketera
          orientation: 'portrait' as const,
          compress: true
        }
      };

      await html2pdf().set(options).from(container).save();
      
      document.body.removeChild(container);
      toast.success('PDF descargado (80mm)');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadHTML = () => {
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
    
    toast.success('HTML descargado');
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
        
        <div className="p-4 border-t space-y-2 shrink-0">
          <div className="flex gap-2">
            <Button 
              onClick={handleDownloadPDF} 
              className="flex-1 gap-2"
              disabled={!html || isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Descargar PDF
            </Button>
            <Button 
              onClick={handlePrint} 
              variant="outline"
              className="gap-2"
              disabled={!html || isPrinting}
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Imprimir
            </Button>
          </div>
          <Button 
            onClick={handleDownloadHTML} 
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            disabled={!html}
          >
            <Download className="w-4 h-4" />
            Descargar HTML
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
