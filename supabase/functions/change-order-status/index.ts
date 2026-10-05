import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAFE_STATUSES = new Set(["pending", "preparation", "ready"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const designatedSuperadminEmail = (
      Deno.env.get("MARK_DELIVERED_OTP_EMAIL") || "jvelit89@gmail.com"
    ).toLowerCase();

    const isSuperadmin =
      roleData?.role === "superadmin" ||
      user.email?.toLowerCase() === designatedSuperadminEmail;
    const isProduction = roleData?.role === "operario";

    if (!isSuperadmin && !isProduction) {
      return json({ error: "Solo Producción o Superadmin pueden realizar este cambio sin OTP" }, 403);
    }

    const { orderIds, targetStatus } = await req.json();

    if (!Array.isArray(orderIds) || orderIds.length === 0 || !SAFE_STATUSES.has(targetStatus)) {
      return json({
        error: "Este cambio requiere OTP o los datos enviados son inválidos",
      }, 400);
    }

    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({
        status: targetStatus,
        delivered_at: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", orderIds)
      .select("id");

    if (updateError) {
      console.error("Direct production status update error:", updateError);
      return json({ error: "No se pudo actualizar el estado", detail: updateError.message }, 500);
    }

    return json({
      success: true,
      updated: updatedOrders?.length ?? orderIds.length,
      status: targetStatus,
      otpRequired: false,
    });
  } catch (error) {
    console.error("change-order-status error:", error);
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
