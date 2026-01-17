import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  otpCode: string;
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

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || (roleData.role !== "admin" && roleData.role !== "superadmin")) {
      return new Response(
        JSON.stringify({ error: "Only admins can delete orders" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { otpCode }: VerifyOtpRequest = await req.json();

    // Find valid OTP
    const { data: otpData, error: otpError } = await supabase
      .from("delete_otp_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("otp_code", otpCode)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.log("OTP verification failed:", otpError);
      return new Response(
        JSON.stringify({ error: "Código inválido o expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabase
      .from("delete_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    let deletedCount = 0;

    if (otpData.delete_all) {
      // Get user's company_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (profileData?.company_id) {
        // First delete order_items, then orders
        const { data: ordersToDelete } = await supabase
          .from("orders")
          .select("id")
          .eq("company_id", profileData.company_id);

        if (ordersToDelete && ordersToDelete.length > 0) {
          const orderIdsToDelete = ordersToDelete.map(o => o.id);
          
          // Delete order items first
          await supabase
            .from("order_items")
            .delete()
            .in("order_id", orderIdsToDelete);

          // Delete stock movements related to orders
          await supabase
            .from("stock_movements")
            .delete()
            .in("reference_id", orderIdsToDelete);

          // Delete orders
          const { error: deleteError } = await supabase
            .from("orders")
            .delete()
            .eq("company_id", profileData.company_id);

          if (deleteError) {
            console.error("Error deleting all orders:", deleteError);
            return new Response(
              JSON.stringify({ error: "Error al eliminar pedidos" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          deletedCount = orderIdsToDelete.length;
        }
      }
    } else {
      // Delete specific orders
      const orderIds = otpData.order_ids as string[];
      
      // Delete order items first
      await supabase
        .from("order_items")
        .delete()
        .in("order_id", orderIds);

      // Delete stock movements related to orders
      await supabase
        .from("stock_movements")
        .delete()
        .in("reference_id", orderIds);

      // Delete orders
      const { error: deleteError } = await supabase
        .from("orders")
        .delete()
        .in("id", orderIds);

      if (deleteError) {
        console.error("Error deleting orders:", deleteError);
        return new Response(
          JSON.stringify({ error: "Error al eliminar pedidos" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      deletedCount = orderIds.length;
    }

    console.log(`Successfully deleted ${deletedCount} orders`);

    return new Response(
      JSON.stringify({ success: true, deletedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-delete-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
