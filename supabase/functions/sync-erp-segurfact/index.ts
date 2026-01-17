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

interface SyncRequest {
  order_id: string;
  customer_name: string;
  customer_address: string;
  order_items: OrderItem[];
  total: number;
  delivery_date: string | null;
  notes: string | null;
}

// Helper to normalize URL (remove trailing slash)
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

// Create HTTP client that skips SSL verification for self-signed certificates
function createInsecureClient() {
  try {
    return Deno.createHttpClient({
      caCerts: [],
    });
  } catch {
    // If createHttpClient is not available, return undefined
    return undefined;
  }
}

// Fetch with SSL bypass option
async function insecureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const client = createInsecureClient();
  
  if (client) {
    try {
      const response = await fetch(url, {
        ...options,
        // @ts-ignore - Deno specific option
        client,
      });
      return response;
    } catch (error) {
      console.log('Insecure fetch failed, trying standard fetch...');
    }
  }
  
  // Fallback to standard fetch
  return fetch(url, options);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawUrl = Deno.env.get('SEGURFACT_URL');
    const SEGURFACT_EMAIL = Deno.env.get('SEGURFACT_EMAIL');
    const SEGURFACT_PASSWORD = Deno.env.get('SEGURFACT_PASSWORD');

    if (!rawUrl || !SEGURFACT_EMAIL || !SEGURFACT_PASSWORD) {
      console.error('Missing Segurfact credentials in environment');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciales de Segurfact no configuradas' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize URL to avoid double slashes
    const SEGURFACT_URL = normalizeUrl(rawUrl);
    console.log('Using Segurfact URL:', SEGURFACT_URL);

    const body: SyncRequest = await req.json();
    console.log('Received sync request for order:', body.order_id);
    console.log('Customer:', body.customer_name);
    console.log('Items count:', body.order_items.length);
    console.log('Total:', body.total);

    // Step 1: Login to Segurfact ERP
    console.log('Attempting login to Segurfact ERP...');
    
    let loginResponse: Response;
    let authToken = '';
    let loginSuccess = false;

    // Try JSON API login first
    try {
      loginResponse = await insecureFetch(`${SEGURFACT_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: SEGURFACT_EMAIL,
          password: SEGURFACT_PASSWORD,
        }),
      });

      if (loginResponse.ok) {
        loginSuccess = true;
        try {
          const loginData = await loginResponse.json();
          authToken = loginData.token || loginData.access_token || loginData.api_token || '';
          console.log('Login successful via API endpoint');
        } catch {
          const setCookie = loginResponse.headers.get('set-cookie');
          if (setCookie) {
            authToken = setCookie;
          }
        }
      }
    } catch (apiError) {
      console.log('API login failed:', apiError);
    }

    // Try form-based login as fallback
    if (!loginSuccess) {
      console.log('Trying form-based login...');
      try {
        loginResponse = await insecureFetch(`${SEGURFACT_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html, application/json',
          },
          body: new URLSearchParams({
            email: SEGURFACT_EMAIL,
            password: SEGURFACT_PASSWORD,
            _token: '', // CSRF token placeholder
          }),
          redirect: 'manual', // Don't follow redirects automatically
        });

        // Check for successful login (usually redirects on success)
        if (loginResponse.status === 302 || loginResponse.status === 200) {
          loginSuccess = true;
          const setCookie = loginResponse.headers.get('set-cookie');
          if (setCookie) {
            authToken = setCookie;
            console.log('Login successful via form endpoint');
          }
        }
      } catch (formError) {
        console.log('Form login failed:', formError);
      }
    }

    if (!loginSuccess) {
      console.error('All login attempts failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No se pudo autenticar con Segurfact ERP',
          details: 'Verifique las credenciales y que el servidor ERP esté accesible. El certificado SSL del servidor puede no ser válido.',
          order_id: body.order_id
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Login successful, proceeding to create sales note...');

    // Step 2: Create Nota de Venta (Sales Note)
    const salesNoteData = {
      cliente: body.customer_name,
      direccion: body.customer_address,
      fecha_entrega: body.delivery_date || new Date().toISOString().split('T')[0],
      observaciones: body.notes || '',
      items: body.order_items.map(item => ({
        descripcion: item.product_name,
        cantidad: item.quantity,
        precio_unitario: item.unit_price,
        subtotal: item.total,
      })),
      total: body.total,
      referencia_externa: body.order_id,
    };

    console.log('Creating sales note with data:', JSON.stringify(salesNoteData, null, 2));

    // Try multiple endpoints for creating sales note
    const endpoints = [
      `${SEGURFACT_URL}/api/ventas/nota-venta`,
      `${SEGURFACT_URL}/api/notas-venta`,
      `${SEGURFACT_URL}/ventas/nota-venta/crear`,
      `${SEGURFACT_URL}/ventas/store`,
    ];

    let salesSuccess = false;
    let salesResult: Record<string, unknown> = {};

    for (const endpoint of endpoints) {
      try {
        console.log('Trying endpoint:', endpoint);
        const salesResponse = await insecureFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
            'Cookie': authToken,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(salesNoteData),
        });

        if (salesResponse.ok) {
          try {
            salesResult = await salesResponse.json();
            salesSuccess = true;
            console.log('Sales note created successfully via:', endpoint);
            break;
          } catch {
            // Response wasn't JSON but was successful
            salesSuccess = true;
            console.log('Sales note created (non-JSON response) via:', endpoint);
            break;
          }
        } else {
          const errorText = await salesResponse.text();
          console.log(`Endpoint ${endpoint} failed:`, salesResponse.status, errorText.substring(0, 200));
        }
      } catch (endpointError) {
        console.log(`Endpoint ${endpoint} error:`, endpointError);
      }
    }

    if (!salesSuccess) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No se pudo crear la nota de venta en Segurfact',
          details: 'La autenticación fue exitosa pero no se pudo crear el documento. Contacte al administrador del ERP.',
          order_id: body.order_id
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Nota de venta creada en Segurfact',
        erp_reference: salesResult.id || salesResult.numero || 'N/A',
        order_id: body.order_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error syncing with Segurfact ERP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's an SSL certificate error
    const isSslError = errorMessage.includes('certificate') || 
                       errorMessage.includes('SSL') || 
                       errorMessage.includes('TLS') ||
                       errorMessage.includes('UnknownIssuer');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: isSslError 
          ? 'Error de certificado SSL con Segurfact ERP' 
          : 'Error de conexión con Segurfact ERP',
        details: isSslError
          ? 'El servidor Segurfact tiene un certificado SSL no válido o auto-firmado. Contacte al administrador del ERP para resolver este problema.'
          : errorMessage
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
