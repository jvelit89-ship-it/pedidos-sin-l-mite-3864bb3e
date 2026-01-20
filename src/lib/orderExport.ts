import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ExportOrder {
  id: string;
  customer_name: string;
  status: string;
  total: number;
  vendedor_name: string | null;
  repartidor_name: string | null;
  delivery_address: string | null;
  created_at: string;
  delivered_at: string | null;
  order_items?: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

export interface ExportOptions {
  orders: ExportOrder[];
  fileName: string;
  formatCurrency: (value: number) => string;
  statusLabels: Record<string, string>;
}

/**
 * Export orders to XLS (Excel) format
 */
export function exportToXLS({ orders, fileName, formatCurrency, statusLabels }: ExportOptions): void {
  if (orders.length === 0) return;

  // Create HTML table for Excel
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Pedidos</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #4472C4; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #D9E2F3; }
        .number { mso-number-format:"\\@"; }
        .currency { mso-number-format:"#,##0.00"; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Vendedor</th>
            <th>Repartidor</th>
            <th>Dirección</th>
            <th>Productos</th>
            <th>Cant. Items</th>
            <th>Fecha Creación</th>
            <th>Hora</th>
            <th>Fecha Entrega</th>
          </tr>
        </thead>
        <tbody>
  `;

  orders.forEach(order => {
    const products = order.order_items?.map(item => 
      `${item.product_name} x${item.quantity}`
    ).join(', ') || '';
    
    const totalItems = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const statusLabel = statusLabels[order.status] || order.status;
    
    html += `
      <tr>
        <td class="number">${order.id.slice(0, 8)}</td>
        <td>${escapeHtml(order.customer_name)}</td>
        <td>${statusLabel}</td>
        <td class="currency">${order.total.toFixed(2)}</td>
        <td>${order.vendedor_name || '-'}</td>
        <td>${order.repartidor_name || '-'}</td>
        <td>${escapeHtml(order.delivery_address || '-')}</td>
        <td>${escapeHtml(products)}</td>
        <td>${totalItems}</td>
        <td>${format(new Date(order.created_at), 'dd/MM/yyyy')}</td>
        <td>${format(new Date(order.created_at), 'HH:mm')}</td>
        <td>${order.delivered_at ? format(new Date(order.delivered_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xls`);
}

/**
 * Export orders to PDF format
 */
export function exportToPDF({ orders, fileName, formatCurrency, statusLabels }: ExportOptions): void {
  if (orders.length === 0) return;

  // Calculate totals
  const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = orders.reduce((sum, o) => 
    sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0), 0
  );

  // Create printable HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Pedidos</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          font-size: 11px; 
          color: #000 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px; 
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }
        .header h1 { font-size: 18px; margin-bottom: 5px; }
        .header p { font-size: 12px; color: #666; }
        .summary { 
          display: flex; 
          justify-content: space-around; 
          margin-bottom: 20px;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 5px;
        }
        .summary-item { text-align: center; }
        .summary-item .value { font-size: 16px; font-weight: bold; color: #333; }
        .summary-item .label { font-size: 10px; color: #666; }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 6px 8px; 
          text-align: left;
          font-size: 10px;
        }
        th { 
          background: #333 !important; 
          color: #fff !important; 
          font-weight: bold;
        }
        tr:nth-child(even) { background: #f9f9f9; }
        .status-delivered { color: #22c55e; font-weight: bold; }
        .status-cancelled { color: #ef4444; font-weight: bold; }
        .status-pending { color: #f59e0b; font-weight: bold; }
        .text-right { text-align: right; }
        .footer { 
          margin-top: 20px; 
          text-align: center; 
          font-size: 9px; 
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          th { background: #333 !important; color: #fff !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📋 Reporte de Pedidos</h1>
        <p>Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
      
      <div class="summary">
        <div class="summary-item">
          <div class="value">${orders.length}</div>
          <div class="label">Total Pedidos</div>
        </div>
        <div class="summary-item">
          <div class="value">${totalItems}</div>
          <div class="label">Total Items</div>
        </div>
        <div class="summary-item">
          <div class="value">${formatCurrency(totalAmount)}</div>
          <div class="label">Monto Total</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Productos</th>
            <th class="text-right">Total</th>
            <th>Vendedor</th>
            <th>Repartidor</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => {
            const products = order.order_items?.map(item => 
              `${item.product_name} x${item.quantity}`
            ).join(', ') || '';
            const statusLabel = statusLabels[order.status] || order.status;
            const statusClass = order.status === 'delivered' ? 'status-delivered' : 
                               order.status === 'cancelled' ? 'status-cancelled' : 
                               order.status === 'pending' ? 'status-pending' : '';
            
            return `
              <tr>
                <td>${order.id.slice(0, 8)}</td>
                <td>${escapeHtml(order.customer_name)}</td>
                <td class="${statusClass}">${statusLabel}</td>
                <td>${escapeHtml(products)}</td>
                <td class="text-right">${formatCurrency(order.total)}</td>
                <td>${order.vendedor_name || '-'}</td>
                <td>${order.repartidor_name || '-'}</td>
                <td>${format(new Date(order.created_at), 'dd/MM HH:mm')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        Sistema de Pedidos y Entregas - ${format(new Date(), 'yyyy')}
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}