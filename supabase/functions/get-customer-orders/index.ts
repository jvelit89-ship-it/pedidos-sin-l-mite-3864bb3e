import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderSummary {
  id: string;
  tracking_code: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Número de teléfono requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    
    // Validate phone format (9 digits for Peru)
    if (cleanPhone.length < 9) {
      return new Response(
        JSON.stringify({ error: 'Formato de teléfono inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query orders with minimal data - NO customer name, address, phone, or total exposed
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, tracking_code, status, created_at, delivered_at, customer_phone')
      .eq('customer_phone', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching orders:', error);
      return new Response(
        JSON.stringify({ error: 'Error al buscar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return minimal order summaries - remove any PII
    const response: OrderSummary[] = (orders || []).map(order => ({
      id: order.id,
      tracking_code: order.tracking_code,
      status: order.status,
      created_at: order.created_at,
      delivered_at: order.delivered_at,
    }));

    console.log(`Found ${response.length} orders for phone ending in: ...${cleanPhone.slice(-4)}`);

    return new Response(
      JSON.stringify({ orders: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-customer-orders:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
