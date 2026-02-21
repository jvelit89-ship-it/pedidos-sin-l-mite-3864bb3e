import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTO_DELIVER_HOURS = 4; // Auto-mark as delivered after 4 hours in transit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffTime = new Date(Date.now() - AUTO_DELIVER_HOURS * 60 * 60 * 1000).toISOString();

    // Find orders stuck in 'delivery' status for more than 4 hours
    const { data: stuckOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, customer_name, repartidor_name, repartidor_id, company_id, updated_at')
      .eq('status', 'delivery')
      .lt('updated_at', cutoffTime);

    if (fetchError) {
      console.error('Error fetching stuck orders:', fetchError);
      throw fetchError;
    }

    if (!stuckOrders || stuckOrders.length === 0) {
      console.log('No stuck orders found');
      return new Response(
        JSON.stringify({ message: 'No stuck orders', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stuckOrders.length} stuck orders to auto-deliver`);

    const now = new Date().toISOString();

    // Auto-mark as delivered
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        updated_at: now,
        notes: 'Auto-entregado por sistema (tiempo excedido)',
      })
      .in('id', stuckOrders.map(o => o.id));

    if (updateError) {
      console.error('Error auto-delivering orders:', updateError);
      throw updateError;
    }

    // Log each auto-delivery
    const logEntries = stuckOrders.map(order => ({
      action: 'auto_deliver',
      entity: 'orders',
      entity_id: order.id,
      company_id: order.company_id,
      details: {
        reason: `Pedido en tránsito por más de ${AUTO_DELIVER_HOURS} horas`,
        repartidor_id: order.repartidor_id,
        repartidor_name: order.repartidor_name,
        customer_name: order.customer_name,
        original_updated_at: order.updated_at,
      },
    }));

    await supabase.from('logs').insert(logEntries);

    console.log(`Auto-delivered ${stuckOrders.length} orders`);

    return new Response(
      JSON.stringify({ 
        message: `Auto-delivered ${stuckOrders.length} orders`,
        count: stuckOrders.length,
        orders: stuckOrders.map(o => ({ id: o.id, customer: o.customer_name })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-deliver-orders:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
