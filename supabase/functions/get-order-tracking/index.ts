import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingResponse {
  id: string;
  tracking_code: string;
  status: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  repartidor_first_name: string | null;
  customer_first_name: string;
  has_delivery_address: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tracking_code } = await req.json();

    // Validate tracking code format (8 alphanumeric characters)
    if (!tracking_code || typeof tracking_code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Código de seguimiento requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCode = tracking_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(cleanCode)) {
      return new Response(
        JSON.stringify({ error: 'Formato de código inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query order with minimal data exposure
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        tracking_code,
        status,
        created_at,
        updated_at,
        delivered_at,
        customer_name,
        delivery_address,
        repartidor_id
      `)
      .eq('tracking_code', cleanCode)
      .single();

    if (error || !order) {
      console.log('Order not found for tracking code:', cleanCode);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get repartidor first name only if assigned
    let repartidorFirstName: string | null = null;
    if (order.repartidor_id) {
      const { data: repartidor } = await supabase
        .from('repartidores')
        .select('name')
        .eq('id', order.repartidor_id)
        .single();
      
      if (repartidor?.name) {
        // Only return first name for privacy
        repartidorFirstName = repartidor.name.split(' ')[0];
      }
    }

    // Return minimal tracking info - no full customer name, address, phone, or total
    const response: TrackingResponse = {
      id: order.id,
      tracking_code: order.tracking_code,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      delivered_at: order.delivered_at,
      repartidor_first_name: repartidorFirstName,
      customer_first_name: order.customer_name ? order.customer_name.split(' ')[0] : 'Cliente',
      has_delivery_address: !!order.delivery_address,
    };

    console.log('Successfully returned tracking info for:', cleanCode);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-order-tracking:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
