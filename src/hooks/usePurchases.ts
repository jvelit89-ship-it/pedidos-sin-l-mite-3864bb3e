import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Supplier } from '@/hooks/useSuppliers';

export interface Purchase {
  id: string;
  supplier_id: string;
  receipt_type: string;
  receipt_series: string | null;
  receipt_number: string;
  issue_date: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  status: 'active' | 'cancelled';
  cancelled_at: string | null;
  cancelled_by: string | null;
  company_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  stock_updated: boolean;
}

export interface NewPurchaseData {
  supplier_id: string;
  receipt_type: string;
  receipt_series?: string;
  receipt_number: string;
  issue_date: string;
  currency: string;
  notes?: string;
  items: {
    product_id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_cost: number;
  }[];
}

export function usePurchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all purchases with supplier info
  const { data: purchases = [], isLoading: loadingPurchases, refetch: refetchPurchases } = useQuery({
    queryKey: ['purchases', user?.companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!user?.companyId,
  });

  // Fetch purchase stats
  const { data: stats } = useQuery({
    queryKey: ['purchase-stats', user?.companyId],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const { data: allPurchases, error } = await supabase
        .from('purchases')
        .select('total, status, created_at')
        .eq('status', 'active');

      if (error) throw error;

      const total = allPurchases?.length || 0;
      const totalAmount = allPurchases?.reduce((sum, p) => sum + Number(p.total), 0) || 0;
      const thisMonth = allPurchases?.filter(p => p.created_at >= startOfMonth).length || 0;
      const thisMonthAmount = allPurchases?.filter(p => p.created_at >= startOfMonth).reduce((sum, p) => sum + Number(p.total), 0) || 0;

      return {
        totalPurchases: total,
        totalAmount,
        monthlyPurchases: thisMonth,
        monthlyAmount: thisMonthAmount,
      };
    },
    enabled: !!user?.companyId,
  });

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async (data: NewPurchaseData) => {
      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
      const tax = subtotal * 0.18; // IGV 18%
      const total = subtotal + tax;

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          supplier_id: data.supplier_id,
          receipt_type: data.receipt_type,
          receipt_series: data.receipt_series || null,
          receipt_number: data.receipt_number,
          issue_date: data.issue_date,
          currency: data.currency,
          subtotal,
          tax,
          total,
          notes: data.notes || null,
          company_id: user?.companyId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const items = data.items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Compra registrada',
        description: 'La compra se ha registrado y el stock se ha actualizado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Cancel purchase mutation
  const cancelPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('purchases')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
        })
        .eq('id', purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Compra anulada',
        description: 'La compra se ha anulado y el stock se ha revertido.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get purchase details with items
  const getPurchaseDetails = async (purchaseId: string) => {
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('id', purchaseId)
      .single();

    if (purchaseError) throw purchaseError;

    const { data: items, error: itemsError } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', purchaseId);

    if (itemsError) throw itemsError;

    return { ...purchase, items } as Purchase;
  };

  return {
    purchases,
    loadingPurchases,
    stats,
    refetchPurchases,
    createPurchase: createPurchaseMutation.mutateAsync,
    cancelPurchase: cancelPurchaseMutation.mutateAsync,
    isCreatingPurchase: createPurchaseMutation.isPending,
    isCancellingPurchase: cancelPurchaseMutation.isPending,
    getPurchaseDetails,
  };
}
