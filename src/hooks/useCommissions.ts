import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface ProductCommission {
  product_id: string;
  product_name: string;
  commission_amount: number;
}

interface CommissionDetail {
  order_id: string;
  order_date: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  commission_per_unit: number;
  total_commission: number;
  unit_price?: number;
  sale_total?: number;
  commissionable_quantity?: number;
}

/**
 * Calculates the quantity that should receive commission, excluding free products.
 * Handles standard promotions (e.g., Buy 20 get 1 free, 40 get 5 free for ice,
 * and 100+15, 200+40, 400+100 for water 20L).
 */
function calculateCommissionableQuantity(quantity: number, total: number, unitPrice: number, basePrice: number, productName: string = ''): number {
  if (basePrice <= 0) return quantity;
  
  const name = productName.toLowerCase();
  
  // Rule 1: Water products without "extra" promotions always commission full quantity
  // User explicitly mentioned 8L, 625ml, and 1L water products have no extra promotions.
  if (name.includes('agua') && (name.includes('8l') || name.includes('625ml') || name.includes('1l'))) {
    return quantity;
  }

  // Rule 2: Special base price for Agua 20L Recarga (Distributors)
  let effectiveBasePrice = basePrice;
  if (name.includes('20l') && name.includes('recarga')) {
    // Standard price is 10, distributor price is 5.
    // If selling near or below 7, it's likely a distributor sale or promotion.
    if (unitPrice <= 7) {
      effectiveBasePrice = 5;
    }
  }

  // Rule 3: For products with "extras" (Hielo and Agua 20L), only commission what was effectively paid for.
  // If price is normal or higher, all items are commissionable
  if (unitPrice >= effectiveBasePrice) return quantity;

  // Calculate effectively paid units based on total and base price
  const calculatedPaidUnits = Math.round(total / effectiveBasePrice);
  
  // If total is 0, no commission
  if (total <= 0) return 0;
  
  // Return the minimum of requested quantity and effectively paid units
  // This correctly handles "X + Y gratis" where total = X * basePrice
  return Math.min(quantity, calculatedPaidUnits);
}

interface VendedorCommissionSummary {
  vendedor_id: string;
  vendedor_name: string;
  period1_units: number;
  period1_commission: number;
  period2_units: number;
  period2_commission: number;
  total_units: number;
  total_commission: number;
  pending_units: number;
  pending_commission: number;
  details: CommissionDetail[];
  pending_details: CommissionDetail[];
}

interface DailyCommission {
  date: string;
  units: number;
  commission: number;
  details: CommissionDetail[];
}

async function getUserCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  return profile?.company_id || null;
}

export function useProductCommissions() {
  const { data: products, loading, refetch } = useRealtimeQuery<any>('products', {
    orderBy: { column: 'name', ascending: true },
  });

  const setProductCommission = useCallback(async (productId: string, amount: number, type: 'vendedor' | 'operario' | 'repartidor' = 'vendedor') => {
    const column = type === 'operario' ? 'operario_commission_amount' : type === 'repartidor' ? 'repartidor_commission_amount' : 'commission_amount';
    const { error } = await supabase
      .from('products')
      .update({ [column]: amount })
      .eq('id', productId);

    if (error) {
      toast.error('Error al actualizar comisión');
      console.error('Error updating commission:', error);
      return false;
    }

    toast.success('Comisión actualizada');
    refetch();
    return true;
  }, [refetch]);

  const getProductsWithCommissions = useCallback(() => {
    return (products || []).map((p: any) => ({
      product_id: p.id,
      product_name: p.name,
      commission_amount: p.commission_amount || 0,
      operario_commission_amount: p.operario_commission_amount || 0,
      repartidor_commission_amount: p.repartidor_commission_amount || 0,
    }));
  }, [products]);

  return {
    products: getProductsWithCommissions(),
    loading,
    refetch,
    setProductCommission,
  };
}

export function useVendorCommissions(year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateCommissions = useCallback(async (): Promise<VendedorCommissionSummary[]> => {
    setLoading(true);
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return [];

      // Get all active vendedores
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('active', true);

      if (!vendedores) return [];

      // Calculate date ranges
      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2Start = new Date(year, month - 1, 16);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      // Get orders with items for this month (both delivered and pending/in-route)
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          vendedor_id,
          customer_name,
          status,
          created_at,
          delivered_at,
          order_items (
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('company_id', companyId)
        .neq('status', 'cancelled')
        .gte('created_at', period1Start.toISOString())
        .lte('created_at', period2End.toISOString());

      // Get all products with commission amounts and base prices
      const { data: products } = await supabase
        .from('products')
        .select('id, commission_amount, price')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.commission_amount || 0])
      );
      
      const productPrices = new Map(
        (products || []).map(p => [p.id, p.price || 0])
      );

      // Get prepaid packages created in this period (commission paid upfront on sale)
      const { data: prepaidPackages } = await (supabase as any)
        .from('customer_prepaid_packages')
        .select('id, vendedor_id, product_id, total_units, unit_price, created_at, customers(name), products(name)')
        .eq('company_id', companyId)
        .not('vendedor_id', 'is', null)
        .gte('created_at', period1Start.toISOString())
        .lte('created_at', period2End.toISOString());

      // Get prepaid usages for orders in this period to EXCLUDE from order-based commission
      // (avoid double-paying: commission was already granted when the package was sold)
      const { data: prepaidUsages } = await (supabase as any)
        .from('prepaid_package_usages')
        .select('order_id, quantity_used, customer_prepaid_packages!inner(product_id)')
        .eq('company_id', companyId)
        .gte('created_at', period1Start.toISOString())
        .lte('created_at', period2End.toISOString());

      // Map: `${order_id}::${product_id}` -> total quantity covered by prepaid
      const prepaidCoverage = new Map<string, number>();
      (prepaidUsages || []).forEach((u: any) => {
        const pid = u.customer_prepaid_packages?.product_id;
        if (!pid) return;
        const key = `${u.order_id}::${pid}`;
        prepaidCoverage.set(key, (prepaidCoverage.get(key) || 0) + Number(u.quantity_used || 0));
      });


      const commissions: VendedorCommissionSummary[] = vendedores.map(vendedor => {
        const vendedorOrders = orders?.filter(o => o.vendedor_id === vendedor.id) || [];
        
        let period1Units = 0;
        let period1Commission = 0;
        let period2Units = 0;
        let period2Commission = 0;
        let pendingUnits = 0;
        let pendingCommission = 0;
        const details: CommissionDetail[] = [];
        const pendingDetails: CommissionDetail[] = [];

        vendedorOrders.forEach(order => {
          const isDelivered = order.status === 'delivered';
          const orderDate = new Date(isDelivered ? order.delivered_at! : order.created_at);
          const isPeriod1 = orderDate >= period1Start && orderDate <= period1End;

          (order.order_items || []).forEach((item: any) => {
            const commissionPerUnit = productCommissions.get(item.product_id) || 0;
            const basePrice = productPrices.get(item.product_id) || 0;

            // Subtract quantity already commissioned via prepaid package sale
            const prepaidQty = prepaidCoverage.get(`${order.id}::${item.product_id}`) || 0;
            const effectiveQty = Math.max(0, (item.quantity || 0) - prepaidQty);
            const effectiveTotal = Math.max(0, (item.total || 0) - prepaidQty * (item.unit_price || 0));

            const commissionedQuantity = calculateCommissionableQuantity(
              effectiveQty,
              effectiveTotal,
              item.unit_price || 0,
              basePrice,
              item.product_name || ''
            );

            
            const totalCommission = commissionedQuantity * commissionPerUnit;

            if (isDelivered) {
              if (isPeriod1) {
                period1Units += commissionedQuantity;
                period1Commission += totalCommission;
              } else {
                period2Units += commissionedQuantity;
                period2Commission += totalCommission;
              }

              details.push({
                order_id: order.id,
                order_date: order.delivered_at!,
                customer_name: order.customer_name,
                product_name: item.product_name,
                quantity: item.quantity,
                commissionable_quantity: commissionedQuantity,
                commission_per_unit: commissionPerUnit,
                total_commission: totalCommission,
                unit_price: item.unit_price || 0,
                sale_total: item.total || 0,
              });
            } else {
              pendingUnits += commissionedQuantity;
              pendingCommission += totalCommission;
              
              pendingDetails.push({
                order_id: order.id,
                order_date: order.created_at,
                customer_name: order.customer_name,
                product_name: item.product_name,
                quantity: item.quantity,
                commissionable_quantity: commissionedQuantity,
                commission_per_unit: commissionPerUnit,
                total_commission: totalCommission,
                unit_price: item.unit_price || 0,
                sale_total: item.total || 0,
              });
            }
          });
        });

        return {
          vendedor_id: vendedor.id,
          vendedor_name: vendedor.name,
          period1_units: period1Units,
          period1_commission: period1Commission,
          period2_units: period2Units,
          period2_commission: period2Commission,
          total_units: period1Units + period2Units,
          total_commission: period1Commission + period2Commission,
          pending_units: pendingUnits,
          pending_commission: pendingCommission,
          details: details.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
          pending_details: pendingDetails.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
        };
      });

      return commissions;
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return { calculateCommissions, loading };
}

export function useMyCommissions(vendedorId: string | null, year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateMyCommissions = useCallback(async () => {
    if (!vendedorId) return null;
    setLoading(true);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return null;

      // Calculate date ranges
      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2Start = new Date(year, month - 1, 16);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      // Get orders with items for this month (both delivered and pending/in-route)
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          status,
          created_at,
          delivered_at,
          order_items (
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('vendedor_id', vendedorId)
        .neq('status', 'cancelled')
        .gte('created_at', period1Start.toISOString())
        .lte('created_at', period2End.toISOString());

      // Get all products with commission amounts and base prices
      const { data: products } = await supabase
        .from('products')
        .select('id, commission_amount, price')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.commission_amount || 0])
      );

      const productPrices = new Map(
        (products || []).map(p => [p.id, p.price || 0])
      );

      let period1Units = 0;
      let period1Commission = 0;
      let period2Units = 0;
      let period2Commission = 0;
      let pendingUnits = 0;
      let pendingCommission = 0;
      const details: CommissionDetail[] = [];
      const pendingDetails: CommissionDetail[] = [];

      (orders || []).forEach(order => {
        const isDelivered = order.status === 'delivered';
        const orderDate = new Date(isDelivered ? order.delivered_at! : order.created_at);
        const isPeriod1 = orderDate >= period1Start && orderDate <= period1End;

        (order.order_items || []).forEach((item: any) => {
          const commissionPerUnit = productCommissions.get(item.product_id) || 0;
          const basePrice = productPrices.get(item.product_id) || 0;
          const commissionedQuantity = calculateCommissionableQuantity(
            item.quantity,
            item.total || 0,
            item.unit_price || 0,
            basePrice,
            item.product_name || ''
          );
          
          const totalCommission = commissionedQuantity * commissionPerUnit;

          if (isDelivered) {
            if (isPeriod1) {
              period1Units += commissionedQuantity;
              period1Commission += totalCommission;
            } else {
              period2Units += commissionedQuantity;
              period2Commission += totalCommission;
            }

            details.push({
              order_id: order.id,
              order_date: order.delivered_at!,
              customer_name: order.customer_name,
              product_name: item.product_name,
              quantity: item.quantity,
              commissionable_quantity: commissionedQuantity,
              commission_per_unit: commissionPerUnit,
              total_commission: totalCommission,
              unit_price: item.unit_price || 0,
              sale_total: item.total || 0,
            });
          } else {
            pendingUnits += commissionedQuantity;
            pendingCommission += totalCommission;
            
            pendingDetails.push({
              order_id: order.id,
              order_date: order.created_at,
              customer_name: order.customer_name,
              product_name: item.product_name,
              quantity: item.quantity,
              commissionable_quantity: commissionedQuantity,
              commission_per_unit: commissionPerUnit,
              total_commission: totalCommission,
              unit_price: item.unit_price || 0,
              sale_total: item.total || 0,
            });
          }
        });
      });

      return {
        vendedor_id: vendedorId,
        period1_units: period1Units,
        period1_commission: period1Commission,
        period2_units: period2Units,
        period2_commission: period2Commission,
        total_units: period1Units + period2Units,
        total_commission: period1Commission + period2Commission,
        pending_units: pendingUnits,
        pending_commission: pendingCommission,
        details: details.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
        pending_details: pendingDetails.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
      };
    } finally {
      setLoading(false);
    }
  }, [vendedorId, year, month]);

  const getDailyCommissions = useCallback(async (): Promise<DailyCommission[]> => {
    if (!vendedorId) return [];
    setLoading(true);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return [];

      // Get last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          delivered_at,
          order_items (
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('vendedor_id', vendedorId)
        .eq('status', 'delivered')
        .gte('delivered_at', startDate.toISOString())
        .lte('delivered_at', endDate.toISOString())
        .order('delivered_at', { ascending: false });

      const { data: products } = await supabase
        .from('products')
        .select('id, commission_amount, price')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.commission_amount || 0])
      );

      const productPrices = new Map(
        (products || []).map(p => [p.id, p.price || 0])
      );

      // Group by date
      const dailyMap = new Map<string, DailyCommission>();

      (orders || []).forEach(order => {
        const dateKey = new Date(order.delivered_at!).toISOString().split('T')[0];

        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { date: dateKey, units: 0, commission: 0, details: [] });
        }

        const daily = dailyMap.get(dateKey)!;

        (order.order_items || []).forEach((item: any) => {
          const commissionPerUnit = productCommissions.get(item.product_id) || 0;
          const basePrice = productPrices.get(item.product_id) || 0;
          const commissionedQuantity = calculateCommissionableQuantity(
            item.quantity,
            (item as any).total || 0,
            (item as any).unit_price || 0,
            basePrice,
            item.product_name || ''
          );
          
          const totalCommission = commissionedQuantity * commissionPerUnit;

          daily.units += commissionedQuantity;
          daily.commission += totalCommission;
          daily.details.push({
            order_id: order.id,
            order_date: order.delivered_at!,
            customer_name: order.customer_name,
            product_name: item.product_name,
            quantity: item.quantity,
            commissionable_quantity: commissionedQuantity,
            commission_per_unit: commissionPerUnit,
            total_commission: totalCommission,
          });
        });
      });

      return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  return { calculateMyCommissions, getDailyCommissions, loading };
}

// Operario commission interfaces
interface OperarioProductionDetail {
  production_id: string;
  produced_at: string;
  product_name: string;
  quantity: number;
  commission_per_unit: number;
  total_commission: number;
}

interface OperarioCommissionSummary {
  operario_id: string;
  operario_name: string;
  period1_units: number;
  period1_commission: number;
  period2_units: number;
  period2_commission: number;
  total_units: number;
  total_commission: number;
  details: OperarioProductionDetail[];
}

export function useOperarioCommissions(year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateCommissions = useCallback(async (): Promise<OperarioCommissionSummary[]> => {
    setLoading(true);
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return [];

      // Get all active operarios
      const { data: operarios } = await supabase
        .from('operarios')
        .select('id, name, user_id')
        .eq('company_id', companyId)
        .eq('active', true);

      if (!operarios) return [];

      // Calculate date ranges
      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2Start = new Date(year, month - 1, 16);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      // Get production history for this month
      const { data: productions } = await supabase
        .from('production_history')
        .select(`
          id,
          product_id,
          quantity,
          produced_at,
          produced_by,
          products (name)
        `)
        .eq('company_id', companyId)
        .gte('produced_at', period1Start.toISOString())
        .lte('produced_at', period2End.toISOString());

      // Get all products with operario commission amounts
      const { data: products } = await supabase
        .from('products')
        .select('id, operario_commission_amount')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.operario_commission_amount || 0])
      );

      const commissions: OperarioCommissionSummary[] = operarios.map(operario => {
        // Match productions by produced_by (which stores the auth user_id UUID)
        const operarioProductions = productions?.filter(p => 
          p.produced_by === operario.user_id
        ) || [];
        
        let period1Units = 0;
        let period1Commission = 0;
        let period2Units = 0;
        let period2Commission = 0;
        const details: OperarioProductionDetail[] = [];

        operarioProductions.forEach(prod => {
          const producedAt = new Date(prod.produced_at);
          const isPeriod1 = producedAt >= period1Start && producedAt <= period1End;
          const commissionPerUnit = productCommissions.get(prod.product_id) || 0;
          const totalCommission = prod.quantity * commissionPerUnit;

          if (isPeriod1) {
            period1Units += prod.quantity;
            period1Commission += totalCommission;
          } else {
            period2Units += prod.quantity;
            period2Commission += totalCommission;
          }

          details.push({
            production_id: prod.id,
            produced_at: prod.produced_at,
            product_name: (prod.products as any)?.name || 'Producto',
            quantity: prod.quantity,
            commission_per_unit: commissionPerUnit,
            total_commission: totalCommission,
          });
        });

        return {
          operario_id: operario.id,
          operario_name: operario.name,
          period1_units: period1Units,
          period1_commission: period1Commission,
          period2_units: period2Units,
          period2_commission: period2Commission,
          total_units: period1Units + period2Units,
          total_commission: period1Commission + period2Commission,
          details: details.sort((a, b) => new Date(b.produced_at).getTime() - new Date(a.produced_at).getTime()),
        };
      });

      return commissions;
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return { calculateCommissions, loading };
}

export function useMyOperarioCommissions(operarioId: string | null, year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateMyCommissions = useCallback(async () => {
    if (!operarioId) return null;
    setLoading(true);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return null;

      // Get operario name for matching productions
      const { data: operario } = await supabase
        .from('operarios')
        .select('name, user_id')
        .eq('id', operarioId)
        .single();

      if (!operario) return null;

      // Calculate date ranges
      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2Start = new Date(year, month - 1, 16);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      // Get production history for this month (match by user_id only - produced_by stores the auth user UUID)
      const { data: productions } = await supabase
        .from('production_history')
        .select(`
          id,
          product_id,
          quantity,
          produced_at,
          products (name)
        `)
        .eq('company_id', companyId)
        .eq('produced_by', operario.user_id)
        .gte('produced_at', period1Start.toISOString())
        .lte('produced_at', period2End.toISOString());

      // Get all products with operario commission amounts
      const { data: products } = await supabase
        .from('products')
        .select('id, operario_commission_amount')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.operario_commission_amount || 0])
      );

      let period1Units = 0;
      let period1Commission = 0;
      let period2Units = 0;
      let period2Commission = 0;
      const details: OperarioProductionDetail[] = [];

      (productions || []).forEach(prod => {
        const producedAt = new Date(prod.produced_at);
        const isPeriod1 = producedAt >= period1Start && producedAt <= period1End;
        const commissionPerUnit = productCommissions.get(prod.product_id) || 0;
        const totalCommission = prod.quantity * commissionPerUnit;

        if (isPeriod1) {
          period1Units += prod.quantity;
          period1Commission += totalCommission;
        } else {
          period2Units += prod.quantity;
          period2Commission += totalCommission;
        }

        details.push({
          production_id: prod.id,
          produced_at: prod.produced_at,
          product_name: (prod.products as any)?.name || 'Producto',
          quantity: prod.quantity,
          commission_per_unit: commissionPerUnit,
          total_commission: totalCommission,
        });
      });

      return {
        operario_id: operarioId,
        period1_units: period1Units,
        period1_commission: period1Commission,
        period2_units: period2Units,
        period2_commission: period2Commission,
        total_units: period1Units + period2Units,
        total_commission: period1Commission + period2Commission,
        details: details.sort((a, b) => new Date(b.produced_at).getTime() - new Date(a.produced_at).getTime()),
      };
    } finally {
      setLoading(false);
    }
  }, [operarioId, year, month]);

  return { calculateMyCommissions, loading };
}

// Repartidor commission interfaces
interface RepartidorCommissionSummary {
  repartidor_id: string;
  repartidor_name: string;
  period1_units: number;
  period1_commission: number;
  period2_units: number;
  period2_commission: number;
  total_units: number;
  total_commission: number;
  details: CommissionDetail[];
}

export function useRepartidorCommissions(year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateCommissions = useCallback(async (): Promise<RepartidorCommissionSummary[]> => {
    setLoading(true);
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return [];

      const { data: repartidores } = await supabase
        .from('repartidores')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('active', true);

      if (!repartidores) return [];

      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          repartidor_id,
          customer_name,
          delivered_at,
          order_items (
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'delivered')
        .gte('delivered_at', period1Start.toISOString())
        .lte('delivered_at', period2End.toISOString());

      const { data: products } = await supabase
        .from('products')
        .select('id, repartidor_commission_amount, price')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.repartidor_commission_amount || 0])
      );

      const productPrices = new Map(
        (products || []).map(p => [p.id, p.price || 0])
      );

      const commissions: RepartidorCommissionSummary[] = repartidores.map(repartidor => {
        const repartidorOrders = orders?.filter(o => o.repartidor_id === repartidor.id) || [];
        
        let period1Units = 0;
        let period1Commission = 0;
        let period2Units = 0;
        let period2Commission = 0;
        const details: CommissionDetail[] = [];

        repartidorOrders.forEach(order => {
          const deliveredAt = new Date(order.delivered_at!);
          const isPeriod1 = deliveredAt >= period1Start && deliveredAt <= period1End;

          (order.order_items || []).forEach((item: any) => {
            const commissionPerUnit = productCommissions.get(item.product_id) || 0;
            const basePrice = productPrices.get(item.product_id) || 0;
            const commissionedQuantity = calculateCommissionableQuantity(
              item.quantity,
              item.total || 0,
              item.unit_price || 0,
              basePrice,
              item.product_name || ''
            );
            
            const totalCommission = commissionedQuantity * commissionPerUnit;

            if (isPeriod1) {
              period1Units += commissionedQuantity;
              period1Commission += totalCommission;
            } else {
              period2Units += commissionedQuantity;
              period2Commission += totalCommission;
            }

            details.push({
              order_id: order.id,
              order_date: order.delivered_at!,
              customer_name: order.customer_name,
              product_name: item.product_name,
              quantity: item.quantity,
              commissionable_quantity: commissionedQuantity,
              commission_per_unit: commissionPerUnit,
              total_commission: totalCommission,
              unit_price: item.unit_price || 0,
              sale_total: item.total || 0,
            });
          });
        });

        return {
          repartidor_id: repartidor.id,
          repartidor_name: repartidor.name,
          period1_units: period1Units,
          period1_commission: period1Commission,
          period2_units: period2Units,
          period2_commission: period2Commission,
          total_units: period1Units + period2Units,
          total_commission: period1Commission + period2Commission,
          details: details.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
        };
      });

      return commissions;
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return { calculateCommissions, loading };
}

export function useMyRepartidorCommissions(repartidorId: string | null, year: number, month: number) {
  const [loading, setLoading] = useState(false);

  const calculateMyCommissions = useCallback(async () => {
    if (!repartidorId) return null;
    setLoading(true);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return null;

      const period1Start = new Date(year, month - 1, 1);
      const period1End = new Date(year, month - 1, 15, 23, 59, 59);
      const period2End = new Date(year, month, 0, 23, 59, 59);

      // Get repartidor to find their orders
      const { data: repartidor } = await supabase
        .from('repartidores')
        .select('id')
        .eq('id', repartidorId)
        .single();

      if (!repartidor) return null;

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          delivered_at,
          order_items (
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('repartidor_id', repartidorId)
        .eq('status', 'delivered')
        .gte('delivered_at', period1Start.toISOString())
        .lte('delivered_at', period2End.toISOString());

      const { data: products } = await supabase
        .from('products')
        .select('id, repartidor_commission_amount, price')
        .eq('company_id', companyId);

      const productCommissions = new Map(
        (products || []).map(p => [p.id, p.repartidor_commission_amount || 0])
      );

      const productPrices = new Map(
        (products || []).map(p => [p.id, p.price || 0])
      );

      let period1Units = 0;
      let period1Commission = 0;
      let period2Units = 0;
      let period2Commission = 0;
      const details: CommissionDetail[] = [];

      (orders || []).forEach(order => {
        const deliveredAt = new Date(order.delivered_at!);
        const isPeriod1 = deliveredAt >= period1Start && deliveredAt <= period1End;

        (order.order_items || []).forEach((item: any) => {
          const commissionPerUnit = productCommissions.get(item.product_id) || 0;
          const basePrice = productPrices.get(item.product_id) || 0;
          const commissionedQuantity = calculateCommissionableQuantity(
            item.quantity,
            item.total || 0,
            item.unit_price || 0,
            basePrice,
            item.product_name || ''
          );
          
          const totalCommission = commissionedQuantity * commissionPerUnit;

          if (isPeriod1) {
            period1Units += commissionedQuantity;
            period1Commission += totalCommission;
          } else {
            period2Units += commissionedQuantity;
            period2Commission += totalCommission;
          }

          details.push({
            order_id: order.id,
            order_date: order.delivered_at!,
            customer_name: order.customer_name,
            product_name: item.product_name,
            quantity: item.quantity,
            commissionable_quantity: commissionedQuantity,
            commission_per_unit: commissionPerUnit,
            total_commission: totalCommission,
            unit_price: item.unit_price || 0,
            sale_total: item.total || 0,
          });
        });
      });

      return {
        repartidor_id: repartidorId,
        period1_units: period1Units,
        period1_commission: period1Commission,
        period2_units: period2Units,
        period2_commission: period2Commission,
        total_units: period1Units + period2Units,
        total_commission: period1Commission + period2Commission,
        details: details.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
      };
    } finally {
      setLoading(false);
    }
  }, [repartidorId, year, month]);

  return { calculateMyCommissions, loading };
}
