import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { orderId } = await req.json();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  const jwt = authHeader.replace("Bearer ", "");
  const { data: authData, error: authError } = await service.auth.getUser(jwt);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ success: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: role } = await service.from("user_roles").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (!role || !["superadmin", "admin", "vendedor"].includes(role.role)) {
    return new Response(JSON.stringify({ success: false, error: "FORBIDDEN" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: order } = await service
    .from("orders")
    .select("id, company_id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return new Response(JSON.stringify({ success: false, error: "ORDER_NOT_FOUND" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existing } = await service
    .from("order_delivery_pins")
    .select("order_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!existing) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const pin = String(1000 + (bytes[0] % 9000));
    const { error } = await service.from("order_delivery_pins").insert({ order_id: orderId, pin });
    if (error) {
      return new Response(JSON.stringify({ success: false, error: "PIN_CREATE_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
