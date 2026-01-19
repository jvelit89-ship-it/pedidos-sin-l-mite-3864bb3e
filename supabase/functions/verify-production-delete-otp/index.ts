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
        JSON.stringify({ error: "Only admins can delete production history" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { otpCode }: VerifyOtpRequest = await req.json();

    // Find valid OTP from production_delete_otp_codes table
    const { data: otpData, error: otpError } = await supabase
      .from("production_delete_otp_codes")
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
      .from("production_delete_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    let deletedCount = 0;

    // Get user's company_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profileData?.company_id) {
      return new Response(
        JSON.stringify({ error: "No company found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otpData.delete_all) {
      // Get all production history for the company
      const { data: productionToDelete } = await supabase
        .from("production_history")
        .select("id, product_id, quantity")
        .eq("company_id", profileData.company_id);

      if (productionToDelete && productionToDelete.length > 0) {
        const productionIdsToDelete = productionToDelete.map(p => p.id);
        
        // Revert stock for each production record
        for (const production of productionToDelete) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", production.product_id)
            .single();

          if (product) {
            const newStock = Math.max(0, product.stock - production.quantity);
            await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", production.product_id);
          }
        }

        // Delete related stock movements
        await supabase
          .from("stock_movements")
          .delete()
          .in("reference_id", productionIdsToDelete);

        // Delete production history
        const { error: deleteError } = await supabase
          .from("production_history")
          .delete()
          .eq("company_id", profileData.company_id);

        if (deleteError) {
          console.error("Error deleting all production history:", deleteError);
          return new Response(
            JSON.stringify({ error: "Error al eliminar historial de producción" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        deletedCount = productionIdsToDelete.length;
      }
    } else {
      // Delete specific production records
      const productionIds = otpData.production_ids as string[];
      
      // Get production records to revert stock
      const { data: productionToDelete } = await supabase
        .from("production_history")
        .select("id, product_id, quantity")
        .in("id", productionIds);

      if (productionToDelete) {
        // Revert stock for each production record
        for (const production of productionToDelete) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", production.product_id)
            .single();

          if (product) {
            const newStock = Math.max(0, product.stock - production.quantity);
            await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", production.product_id);
          }
        }

        // Delete related stock movements
        await supabase
          .from("stock_movements")
          .delete()
          .in("reference_id", productionIds);

        // Delete production history
        const { error: deleteError } = await supabase
          .from("production_history")
          .delete()
          .in("id", productionIds);

        if (deleteError) {
          console.error("Error deleting production history:", deleteError);
          return new Response(
            JSON.stringify({ error: "Error al eliminar historial de producción" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        deletedCount = productionIds.length;
      }
    }

    console.log(`Successfully deleted ${deletedCount} production records`);

    return new Response(
      JSON.stringify({ success: true, deletedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-production-delete-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
