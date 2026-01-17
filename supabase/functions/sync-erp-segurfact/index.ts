import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SEGURFACT_URL = Deno.env.get('SEGURFACT_URL');
    const SEGURFACT_EMAIL = Deno.env.get('SEGURFACT_EMAIL');
    const SEGURFACT_PASSWORD = Deno.env.get('SEGURFACT_PASSWORD');

    if (!SEGURFACT_URL || !SEGURFACT_EMAIL || !SEGURFACT_PASSWORD) {
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

    const body: SyncRequest = await req.json();
    console.log('Received sync request for order:', body.order_id);
    console.log('Customer:', body.customer_name);
    console.log('Items count:', body.order_items.length);
    console.log('Total:', body.total);

    // Step 1: Login to Segurfact ERP
    console.log('Attempting login to Segurfact ERP...');
    
    const loginResponse = await fetch(`${SEGURFACT_URL}/api/auth/login`, {
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

    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.error('Segurfact login failed:', loginError);
      
      // Try alternative login endpoint
      console.log('Trying alternative login approach...');
      const altLoginResponse = await fetch(`${SEGURFACT_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/html',
        },
        body: new URLSearchParams({
          email: SEGURFACT_EMAIL,
          password: SEGURFACT_PASSWORD,
        }),
      });

      if (!altLoginResponse.ok) {
        console.error('Alternative login also failed');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No se pudo autenticar con Segurfact ERP',
            details: 'El sistema ERP no respondió correctamente. Verifique las credenciales.',
            order_id: body.order_id
          }),
          { 
            status: 200, // Return 200 so the order creation continues
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    console.log('Login successful, proceeding to create sales note...');

    // Extract session/token from login response
    let authToken = '';
    try {
      const loginData = await loginResponse.json();
      authToken = loginData.token || loginData.access_token || '';
    } catch {
      // If JSON parsing fails, try to get from cookies
      const setCookie = loginResponse.headers.get('set-cookie');
      if (setCookie) {
        authToken = setCookie;
      }
    }

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

    // Try to create the sales note
    const salesNoteResponse = await fetch(`${SEGURFACT_URL}/api/ventas/nota-venta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
        'Cookie': authToken,
      },
      body: JSON.stringify(salesNoteData),
    });

    if (!salesNoteResponse.ok) {
      const errorText = await salesNoteResponse.text();
      console.error('Failed to create sales note:', errorText);
      
      // Try alternative endpoint
      const altSalesResponse = await fetch(`${SEGURFACT_URL}/ventas/nota-venta/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Cookie': authToken,
        },
        body: JSON.stringify(salesNoteData),
      });

      if (!altSalesResponse.ok) {
        console.error('Alternative sales note creation also failed');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No se pudo crear la nota de venta en Segurfact',
            details: 'La conexión con el ERP se estableció pero no se pudo crear el documento.',
            order_id: body.order_id
          }),
          { 
            status: 200, // Return 200 so the order creation continues
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const altResult = await altSalesResponse.json();
      console.log('Sales note created via alternative endpoint:', altResult);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nota de venta creada en Segurfact',
          erp_reference: altResult.id || altResult.numero,
          order_id: body.order_id
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const salesNoteResult = await salesNoteResponse.json();
    console.log('Sales note created successfully:', salesNoteResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Nota de venta creada en Segurfact',
        erp_reference: salesNoteResult.id || salesNoteResult.numero,
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
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error de conexión con Segurfact ERP',
        details: errorMessage
      }),
      { 
        status: 200, // Return 200 so the order creation continues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
