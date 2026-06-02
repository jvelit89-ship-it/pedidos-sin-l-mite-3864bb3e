import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  otpCode: string;
  orderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is superadmin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || (roleData.role !== "superadmin" && roleData.role !== "admin")) {
      return new Response(
        JSON.stringify({ error: "Solo Admin o Superadmin pueden realizar esta acción" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { otpCode, orderId }: VerifyOtpRequest = await req.json();
    console.log(`Verificando OTP para usuario ${user.id}, pedido ${orderId}`);

    // Find valid OTP
    const { data: otpData, error: otpError } = await supabase
      .from("reveal_pin_otp_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("otp_code", otpCode)
      .eq("order_id", orderId)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.log("OTP verification failed or not found:", otpError);
      return new Response(
        JSON.stringify({ 
          error: "Código inválido o expirado", 
          details: otpError?.message || "No se encontró el código para este pedido" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the order delivery_pin from the secure table
    const { data: pinData, error: pinError } = await supabase
      .from("order_delivery_pins")
      .select("pin")
      .eq("id", otpData.order_id)
      .single();

    if (pinError || !pinData) {
      console.error("Error fetching order pin:", pinError);
      return new Response(
        JSON.stringify({ error: "No se pudo encontrar el PIN de este pedido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used (by deleting it or adding a used column, but here I'll just delete it)
    await supabase
      .from("reveal_pin_otp_codes")
      .delete()
      .eq("id", otpData.id);

    return new Response(
      JSON.stringify({ success: true, deliveryPin: orderData.delivery_pin }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-reveal-pin-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
