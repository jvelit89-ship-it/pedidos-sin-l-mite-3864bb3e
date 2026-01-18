import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface SalesNoteData {
  order_id: string;
  customer_name: string;
  customer_ruc?: string;
  customer_address: string;
  order_items: OrderItem[];
  total: number;
  delivery_date?: string;
  notes?: string;
  vendedor_name?: string;
  payment_method?: string;
  document_type?: 'dni' | 'ruc';
}

interface SalesNoteResult {
  html: string;
  noteNumber: string;
}

export function useSalesNote() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [salesNoteHtml, setSalesNoteHtml] = useState<string | null>(null);
  const [noteNumber, setNoteNumber] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const generateSalesNote = useCallback(async (data: SalesNoteData): Promise<SalesNoteResult | null> => {
    setIsGenerating(true);
    try {
      console.log('Generating sales note for order:', data.order_id);
      
      const { data: response, error } = await supabase.functions.invoke('generate-sales-note', {
        body: data
      });

      if (error) {
        console.error('Error generating sales note:', error);
        toast.error('Error al generar nota de venta', {
          description: error.message
        });
        return null;
      }

      if (response?.success && response?.html) {
        setSalesNoteHtml(response.html);
        setNoteNumber(response.note_number);
        setIsDialogOpen(true);
        
        toast.success('Nota de venta generada', {
          description: `Nota ${response.note_number} lista para imprimir`
        });

        return {
          html: response.html,
          noteNumber: response.note_number
        };
      } else {
        toast.error('Error al generar nota de venta', {
          description: response?.error || 'Respuesta inválida del servidor'
        });
        return null;
      }
    } catch (error) {
      console.error('Error generating sales note:', error);
      toast.error('Error al generar nota de venta');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const openDialog = useCallback(() => {
    if (salesNoteHtml) {
      setIsDialogOpen(true);
    }
  }, [salesNoteHtml]);

  return {
    generateSalesNote,
    isGenerating,
    salesNoteHtml,
    noteNumber,
    isDialogOpen,
    closeDialog,
    openDialog
  };
}
