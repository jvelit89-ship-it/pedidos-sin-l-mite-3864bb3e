import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export interface SalesReportItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_units: number;
  avg_price: number;
  total_revenue: number;
}

export type SalesPeriod = 'day' | 'week' | 'month' | 'custom';

export interface SalesReportOptions {
  period: SalesPeriod;
  startDate?: Date;
  endDate?: Date;
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

function getPeriodDates(options: SalesReportOptions): { start: Date; end: Date } {
  const now = new Date();
  switch (options.period) {
    case 'day':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
      return {
        start: options.startDate ? startOfDay(options.startDate) : startOfMonth(now),
        end: options.endDate ? endOfDay(options.endDate) : endOfDay(now),
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function useSalesReports() {
  const [data, setData] = useState<SalesReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesReport = useCallback(async (options: SalesReportOptions) => {
    setLoading(true);
    setError(null);

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        setError('No se encontró la empresa del usuario');
        return [];
      }

      const { start, end } = getPeriodDates(options);

      // Query order_items joined with orders filtered by delivered status and date range
      const { data: rawData, error: queryError } = await supabase
        .from('order_items')
        .select(`
          product_id,
          product_name,
          quantity,
          unit_price,
          total,
          orders!inner(status, created_at, company_id)
        `)
        .eq('orders.company_id', companyId)
        .eq('orders.status', 'delivered')
        .gte('orders.created_at', start.toISOString())
        .lte('orders.created_at', end.toISOString());

      if (queryError) {
        console.error('Error fetching sales report:', queryError);
        setError('Error al obtener los datos de ventas');
        return [];
      }

      // Also fetch SKUs for products
      const productIds = [...new Set((rawData || []).map((r: any) => r.product_id))];
      let skuMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, sku')
          .in('id', productIds);
        products?.forEach(p => { skuMap[p.id] = p.sku; });
      }

      // Aggregate by product
      const aggregated: Record<string, SalesReportItem> = {};
      (rawData || []).forEach((item: any) => {
        const pid = item.product_id;
        if (!aggregated[pid]) {
          aggregated[pid] = {
            product_id: pid,
            product_name: item.product_name,
            product_sku: skuMap[pid] || '',
            total_units: 0,
            avg_price: 0,
            total_revenue: 0,
          };
        }
        aggregated[pid].total_units += item.quantity;
        aggregated[pid].total_revenue += item.total;
      });

      // Calculate average price
      Object.values(aggregated).forEach(item => {
        item.avg_price = item.total_units > 0 ? item.total_revenue / item.total_units : 0;
      });

      const result = Object.values(aggregated).sort((a, b) => b.total_revenue - a.total_revenue);
      setData(result);
      return result;
    } catch (err) {
      console.error('Unexpected error in sales report:', err);
      setError('Error inesperado');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchSalesReport };
}

// ---- Export Utilities ----

export function exportSalesReportToXLS(
  items: SalesReportItem[],
  periodLabel: string,
  formatCurrency: (v: number) => string
): void {
  if (items.length === 0) return;

  const totalUnits = items.reduce((s, i) => s + i.total_units, 0);
  const totalRevenue = items.reduce((s, i) => s + i.total_revenue, 0);

  const rows = items.map(item => `
    <tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${escapeHtml(item.product_sku)}</td>
      <td>${item.total_units}</td>
      <td class="currency">${item.avg_price.toFixed(2)}</td>
      <td class="currency">${item.total_revenue.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #4472C4; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #D9E2F3; }
        .currency { mso-number-format:"#,##0.00"; }
        .total-row { background-color: #1F3864; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>Reporte de Ventas por Producto - ${periodLabel}</h2>
      <p>Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
      <br/>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>SKU</th>
            <th>Unidades Vendidas</th>
            <th>Precio Promedio</th>
            <th>Total Ingresos</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">TOTAL</td>
            <td>${totalUnits}</td>
            <td>-</td>
            <td class="currency">${totalRevenue.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ventas_productos_${format(new Date(), 'yyyy-MM-dd')}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportSalesReportToPDF(
  items: SalesReportItem[],
  periodLabel: string,
  formatCurrency: (v: number) => string
): void {
  if (items.length === 0) return;

  const totalUnits = items.reduce((s, i) => s + i.total_units, 0);
  const totalRevenue = items.reduce((s, i) => s + i.total_revenue, 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Ventas - ${periodLabel}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #333; }
        .header h1 { font-size: 18px; margin-bottom: 5px; }
        .header p { font-size: 12px; color: #666; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        .summary-item { text-align: center; }
        .summary-item .value { font-size: 16px; font-weight: bold; }
        .summary-item .label { font-size: 10px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10px; }
        th { background: #333 !important; color: #fff !important; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .total-row { background: #333 !important; color: #fff !important; font-weight: bold; }
        .text-right { text-align: right; }
        .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { background: #333 !important; color: #fff !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Reporte de Ventas por Producto</h1>
        <p>Período: ${periodLabel} | Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
      <div class="summary">
        <div class="summary-item">
          <div class="value">${items.length}</div>
          <div class="label">Productos Vendidos</div>
        </div>
        <div class="summary-item">
          <div class="value">${totalUnits}</div>
          <div class="label">Total Unidades</div>
        </div>
        <div class="summary-item">
          <div class="value">${formatCurrency(totalRevenue)}</div>
          <div class="label">Total Ingresos</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>SKU</th>
            <th class="text-right">Unidades</th>
            <th class="text-right">Precio Prom.</th>
            <th class="text-right">Total Ingresos</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escapeHtmlPDF(item.product_name)}</td>
              <td>${escapeHtmlPDF(item.product_sku)}</td>
              <td class="text-right">${item.total_units}</td>
              <td class="text-right">${formatCurrency(item.avg_price)}</td>
              <td class="text-right">${formatCurrency(item.total_revenue)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">TOTAL</td>
            <td class="text-right">${totalUnits}</td>
            <td class="text-right">-</td>
            <td class="text-right">${formatCurrency(totalRevenue)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">Sistema de Gestión - ${format(new Date(), 'yyyy')}</div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeHtmlPDF(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
