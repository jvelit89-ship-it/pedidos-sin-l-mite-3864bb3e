import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, action, quantity, notes, customerId } = await req.json();

    // Validate phone number for lookup actions
    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Número de teléfono requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    
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

    // Find customer by phone and verify they are a distributor
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, phone, customer_type, company_id')
      .eq('phone', cleanPhone)
      .eq('customer_type', 'distribuidor')
      .maybeSingle();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return new Response(
        JSON.stringify({ error: 'Error al buscar distribuidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'No se encontró un distribuidor con este número' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'register_empty_containers') {
      // Register empty containers
      if (!quantity || quantity < 1) {
        return new Response(
          JSON.stringify({ error: 'Cantidad inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: insertError } = await supabase
        .from('distributor_empty_containers')
        .insert({
          customer_id: customer.id,
          company_id: customer.company_id,
          quantity,
          notes: notes || null,
          status: 'pending',
        });

      if (insertError) {
        console.error('Error registering containers:', insertError);
        return new Response(
          JSON.stringify({ error: 'Error al registrar bidones' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Registered ${quantity} empty containers for distributor ${customer.name}`);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Bidones registrados correctamente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: get distributor dashboard data
    // Get credit packages
    const { data: credits, error: creditsError } = await supabase
      .from('distributor_credits')
      .select('*')
      .eq('customer_id', customer.id)
      .order('purchase_date', { ascending: false });

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
    }

    // Get credit usage history
    const creditIds = (credits || []).map(c => c.id);
    let usage: any[] = [];
    
    if (creditIds.length > 0) {
      const { data: usageData, error: usageError } = await supabase
        .from('distributor_credit_usage')
        .select('*')
        .in('credit_id', creditIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (usageError) {
        console.error('Error fetching usage:', usageError);
      } else {
        usage = usageData || [];
      }
    }

    // Get empty containers history
    const { data: containers, error: containersError } = await supabase
      .from('distributor_empty_containers')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (containersError) {
      console.error('Error fetching containers:', containersError);
    }

    // Calculate stats
    const activeCredits = (credits || []).filter(c => c.is_active);
    const totalRemaining = activeCredits.reduce((acc, c) => acc + c.remaining_credits, 0);
    const totalPurchased = (credits || []).reduce((acc, c) => acc + c.total_credits, 0);
    const totalUsed = totalPurchased - activeCredits.reduce((acc, c) => acc + c.remaining_credits, 0);
    const totalPaid = (credits || []).reduce((acc, c) => acc + Number(c.amount_paid), 0);

    // Pending containers count
    const pendingContainers = (containers || [])
      .filter(c => c.status === 'pending')
      .reduce((acc, c) => acc + c.quantity, 0);

    const response = {
      customer: {
        id: customer.id,
        name: customer.name,
      },
      stats: {
        totalRemaining,
        totalUsed,
        totalPurchased,
        totalPaid,
        activePackages: activeCredits.length,
        pendingContainers,
      },
      credits: credits || [],
      usage: usage,
      containers: containers || [],
    };

    console.log(`Distributor dashboard for ${customer.name}: ${totalRemaining} remaining`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-distributor-data:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
