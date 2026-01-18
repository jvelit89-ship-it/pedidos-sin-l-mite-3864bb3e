import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
      // Crear un contenedor temporal optimizado para 80mm (302px = 80mm * 3.78)
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.cssText = `
        width: 302px;
        max-width: 302px;
        position: absolute;
        left: -9999px;
        top: 0;
        background: white;
        font-family: Arial, sans-serif;
      `;
      document.body.appendChild(container);

      // Esperar a que las imágenes carguen
      const images = container.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) {
                  resolve(true);
                } else {
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(true);
                }
              })
          )
        );
      }
      
      // Pequeño delay adicional para asegurar render completo
      await new Promise(resolve => setTimeout(resolve, 200));

      // Calcular altura del contenido
      const contentHeight = container.scrollHeight;
      const heightInMM = Math.ceil(contentHeight / 3.78) + 5; // Agregar margen

      const options = {
        margin: 0,
        filename: `nota-venta-${noteNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          width: 302,
          windowWidth: 302,
          scrollY: 0,
          scrollX: 0,
        },
        jsPDF: { 
          unit: 'mm', 
          format: [80, heightInMM] as [number, number],
          orientation: 'portrait' as const,
          compress: true,
          hotfixes: ['px_scaling']
        },
        pagebreak: { mode: 'avoid-all' }
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

  // Agregar estilos de impresión al HTML
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
              onClick={handleDownloadPDF} 
              className="flex-1 gap-2"
              disabled={!html || isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Descargar PDF (80mm)
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
