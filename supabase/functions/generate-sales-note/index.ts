import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  delivery_date: string;
  notes?: string;
  vendedor_name?: string;
  payment_method?: string;
  document_type?: 'dni' | 'ruc';
}

// Función para convertir número a texto en español
function numberToWords(num: number): string {
  const units = ['', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
  const teens = ['Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve'];
  const tens = ['', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
  const hundreds = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];

  if (num === 0) return 'Cero';
  if (num === 100) return 'Cien';

  let result = '';
  
  // Cientos
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  
  // Decenas y unidades
  if (num >= 20) {
    result += tens[Math.floor(num / 10)];
    const unit = num % 10;
    if (unit > 0) {
      result += ' y ' + units[unit];
    }
  } else if (num >= 10) {
    result += teens[num - 10];
  } else if (num > 0) {
    result += units[num];
  }
  
  return result.trim();
}

function formatAmount(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  const intWords = numberToWords(intPart);
  return `${intWords} con ${decPart.toString().padStart(2, '0')}/100 Soles`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SalesNoteData = await req.json();
    console.log('Generating sales note for order:', data.order_id);

    // Obtener datos de la empresa desde la API de decolecta
    const DECOLECTA_TOKEN = Deno.env.get('DECOLECTA_API_TOKEN');
    let companyData = {
      name: 'INDUSTRIAS NACIONALES SANTA MARIA SAC',
      ruc: '20609349914',
      address: 'CAL.F MZA. E LOTE. 01 URB. LAS BRISAS DE BARRANCA ETAPA V, BARRANCA, BARRANCA - LIMA',
      phone: '+51 938476063',
      email: 'administracion@innsanma.com',
      logo_url: '/logo-empresa.jpg'
    };

    // Intentar obtener datos actualizados de la API
    if (DECOLECTA_TOKEN) {
      try {
        const apiResponse = await fetch('https://api.decolecta.com/v1/company', {
          headers: {
            'Authorization': `Bearer ${DECOLECTA_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          console.log('Got company data from API:', apiData);
          if (apiData.name) companyData.name = apiData.name;
          if (apiData.ruc) companyData.ruc = apiData.ruc;
          if (apiData.address) companyData.address = apiData.address;
          if (apiData.phone) companyData.phone = apiData.phone;
          if (apiData.email) companyData.email = apiData.email;
        }
      } catch (apiError) {
        console.log('Could not fetch from decolecta API, using defaults:', apiError);
      }
    }

    // Generar número de nota correlativo
    const noteNumber = `NV-${Date.now().toString().slice(-8)}`;
    const currentDate = new Date().toLocaleDateString('es-PE', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    const currentTime = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calcular IGV y subtotal
    const igvRate = 0.18;
    const subtotal = data.total / (1 + igvRate);
    const igv = data.total - subtotal;

    // Generar HTML optimizado para ticketera 80mm
    const ticketHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=80mm">
  <title>Nota de Venta ${noteNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      width: 80mm;
      max-width: 80mm;
      padding: 2mm;
      line-height: 1.3;
      background: white;
      color: black;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: bold;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 3mm 0;
    }
    .logo {
      max-width: 50mm;
      height: auto;
      margin-bottom: 2mm;
    }
    .company-name {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    .header-info {
      font-size: 9px;
      margin-bottom: 1mm;
    }
    .doc-title {
      font-size: 14px;
      font-weight: bold;
      background: #000;
      color: #fff;
      padding: 2mm;
      margin: 3mm 0;
    }
    .doc-number {
      font-size: 12px;
      font-weight: bold;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
      font-size: 10px;
    }
    .info-label {
      font-weight: bold;
    }
    .customer-section {
      text-align: left;
      margin: 2mm 0;
      font-size: 10px;
    }
    .customer-section p {
      margin-bottom: 1mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0;
      font-size: 9px;
    }
    th {
      background: #f0f0f0;
      padding: 1.5mm;
      text-align: left;
      font-size: 8px;
      border-bottom: 1px solid #000;
    }
    td {
      padding: 1.5mm;
      border-bottom: 1px dotted #ccc;
      vertical-align: top;
    }
    .qty {
      text-align: center;
      width: 10mm;
    }
    .price, .total {
      text-align: right;
      width: 15mm;
    }
    .description {
      max-width: 30mm;
      word-wrap: break-word;
    }
    .totals-section {
      text-align: right;
      margin-top: 3mm;
      font-size: 10px;
    }
    .totals-section .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1mm;
    }
    .grand-total {
      font-size: 13px;
      font-weight: bold;
      background: #000;
      color: #fff;
      padding: 2mm;
      margin: 2mm 0;
    }
    .amount-words {
      font-size: 9px;
      font-style: italic;
      margin: 2mm 0;
      padding: 1.5mm;
      background: #f5f5f5;
    }
    .payment-info, .seller-info {
      font-size: 9px;
      margin: 2mm 0;
    }
    .footer {
      margin-top: 4mm;
      font-size: 8px;
      text-align: center;
    }
    .qr-placeholder {
      width: 25mm;
      height: 25mm;
      border: 1px dashed #999;
      margin: 2mm auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      color: #666;
    }
    @media print {
      body {
        width: 80mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="center">
    <img src="${companyData.logo_url}" alt="Logo" class="logo" onerror="this.style.display='none'">
    <div class="company-name">SANTA MARIA</div>
    <div class="header-info">INDUSTRIAS NACIONALES</div>
  </div>
  
  <div class="divider"></div>
  
  <div class="center">
    <div class="company-name">${companyData.name}</div>
    <div class="header-info">RUC ${companyData.ruc}</div>
    <div class="header-info">${companyData.address}</div>
    <div class="header-info">Central telefónica: ${companyData.phone}</div>
    <div class="header-info">Email: ${companyData.email}</div>
  </div>

  <div class="center doc-title">
    NOTA DE VENTA
  </div>
  
  <div class="center">
    <div class="doc-number">${noteNumber}</div>
  </div>

  <div class="info-row">
    <span><span class="info-label">F. Emisión:</span> ${currentDate}</span>
    <span>${currentTime}</span>
  </div>
  ${data.delivery_date ? `
  <div class="info-row">
    <span><span class="info-label">F. Entrega:</span> ${new Date(data.delivery_date).toLocaleDateString('es-PE')}</span>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="customer-section">
    <p><span class="info-label">Cliente:</span> ${data.customer_name}</p>
    ${data.customer_ruc ? `<p><span class="info-label">${data.document_type === 'ruc' ? 'RUC' : 'DNI'}:</span> ${data.customer_ruc}</p>` : ''}
    <p><span class="info-label">Dirección:</span> ${data.customer_address}</p>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th class="qty">CANT.</th>
        <th>DESCRIPCIÓN</th>
        <th class="price">P.UNIT</th>
        <th class="total">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${data.order_items.map(item => `
        <tr>
          <td class="qty">${item.quantity}</td>
          <td class="description">${item.product_name}</td>
          <td class="price">S/ ${item.unit_price.toFixed(2)}</td>
          <td class="total">S/ ${item.total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals-section">
    <div class="row">
      <span>OP. GRAVADAS:</span>
      <span>S/ ${subtotal.toFixed(2)}</span>
    </div>
    <div class="row">
      <span>IGV (18%):</span>
      <span>S/ ${igv.toFixed(2)}</span>
    </div>
  </div>

  <div class="center grand-total">
    TOTAL A PAGAR: S/ ${data.total.toFixed(2)}
  </div>

  <div class="amount-words center">
    Son: ${formatAmount(data.total)}
  </div>

  <div class="divider"></div>

  <div class="payment-info">
    <p><span class="info-label">CONDICIÓN DE PAGO:</span> ${data.payment_method || 'Contado'}</p>
  </div>

  ${data.vendedor_name ? `
  <div class="seller-info">
    <p><span class="info-label">Vendedor:</span> ${data.vendedor_name}</p>
  </div>
  ` : ''}

  ${data.notes ? `
  <div class="payment-info">
    <p><span class="info-label">Notas:</span> ${data.notes}</p>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="footer">
    <p>Gracias por su preferencia</p>
    <p>Documento generado automáticamente</p>
    <p>Ref: ${data.order_id.slice(0, 8)}</p>
  </div>
</body>
</html>
`;

    console.log('Sales note HTML generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        html: ticketHtml,
        note_number: noteNumber,
        generated_at: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating sales note:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
