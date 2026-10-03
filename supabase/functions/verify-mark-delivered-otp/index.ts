import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const designatedSuperadminEmail = (Deno.env.get("MARK_DELIVERED_OTP_EMAIL") || "jvelit89@gmail.com").toLowerCase();
    const isSuperadmin = roleData?.role === "superadmin" || user.email?.toLowerCase() === designatedSuperadminEmail;
    if (!isSuperadmin) {
      return new Response(
        JSON.stringify({ error: "Solo el Superadmin puede cambiar el estado de un pedido" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { otpCode, orderIds, targetStatus } = await req.json();
    const allowedStatuses = ["pending", "preparation", "ready", "delivery", "delivered", "cancelled", "backorder"];
    if (!otpCode || !Array.isArray(orderIds) || orderIds.length === 0 || !allowedStatuses.includes(targetStatus)) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: otpData, error: otpError } = await supabase
      .from("mark_delivered_otp_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("otp_code", otpCode)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpData) {
      return new Response(JSON.stringify({ error: "Código inválido o expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate order ids match
    const storedIds = new Set((otpData.order_ids as string[]) || []);
    for (const id of orderIds) {
      if (!storedIds.has(id)) {
        return new Response(JSON.stringify({ error: "Pedidos no coinciden con el código" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: nowIso,
    };
    if (targetStatus === "delivered") {
      updatePayload.delivered_at = nowIso;
    } else {
      updatePayload.delivered_at = null;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .in("id", orderIds);

    if (updateError) {
      console.error("Update orders error:", updateError);
      return new Response(JSON.stringify({ error: "No se pudo actualizar pedidos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("mark_delivered_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    return new Response(JSON.stringify({ success: true, updated: orderIds.length, status: targetStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-mark-delivered-otp error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
