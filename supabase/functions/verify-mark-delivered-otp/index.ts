import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
    const otpStatuses = ["delivery", "delivered", "cancelled", "backorder"];
    if (!otpCode || !Array.isArray(orderIds) || orderIds.length === 0 || !otpStatuses.includes(targetStatus)) {
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

    const { data: updatedCount, error: updateError } = await supabase.rpc(
      "otp_superadmin_change_order_status",
      { p_order_ids: orderIds, p_status: targetStatus },
    );

    if (updateError) {
      console.error("Update orders error:", updateError);
      return new Response(JSON.stringify({ success: false, error: "No se pudo actualizar el estado del pedido", detail: updateError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetStatus === "delivered") {
      await supabase
        .from("orders")
        .update({
          delivery_confirmation_source: "superadmin_otp",
          delivery_confirmed_by_user_id: user.id,
          delivery_confirmed_by_email: user.email || designatedSuperadminEmail,
          delivery_confirmation_note:
            "Entregado manualmente por Superadmin mediante OTP para apoyar al repartidor.",
        })
        .in("id", orderIds);

      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, company_id, customer_id, customer_name, repartidor_name")
        .in("id", orderIds);

      if (orderRows?.length) {
        await supabase.from("logs").insert(
          orderRows.map((order: any) => ({
            action: "delivery_marked_by_superadmin_otp",
            entity: "orders",
            entity_id: order.id,
            company_id: order.company_id,
            user_id: user.id,
            details: {
              customer_name: order.customer_name,
              repartidor_name: order.repartidor_name,
              superadmin_email: user.email || designatedSuperadminEmail,
              authorization: "otp",
              reason: "Apoyo operativo al repartidor",
            },
          })),
        );

        // Self-heal clearly wrong customer coordinates when the Superadmin
        // confirms a physical delivery after the repartidor was blocked.
        // We only use a very recent blocked GPS attempt and only replace the
        // customer point when the saved point is missing or farther than 200 m.
        for (const order of orderRows as any[]) {
          if (!order.customer_id) continue;

          const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const { data: attempt } = await supabase
            .from("delivery_location_attempts")
            .select("created_at, driver_lat, driver_lng")
            .eq("order_id", order.id)
            .eq("blocked", true)
            .not("driver_lat", "is", null)
            .not("driver_lng", "is", null)
            .gte("created_at", recentCutoff)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!attempt?.driver_lat || !attempt?.driver_lng) continue;

          const { data: customer } = await supabase
            .from("customers")
            .select("latitude, longitude")
            .eq("id", order.customer_id)
            .maybeSingle();

          const oldLat = Number(customer?.latitude);
          const oldLng = Number(customer?.longitude);
          const hasValidSavedPoint =
            Number.isFinite(oldLat) &&
            Number.isFinite(oldLng) &&
            !(oldLat === 0 && oldLng === 0);

          const savedDistance = hasValidSavedPoint
            ? haversineMeters(
                Number(attempt.driver_lat),
                Number(attempt.driver_lng),
                oldLat,
                oldLng,
              )
            : null;

          if (savedDistance == null || savedDistance > 200) {
            const { error: repairError } = await supabase
              .from("customers")
              .update({
                latitude: Number(attempt.driver_lat),
                longitude: Number(attempt.driver_lng),
                updated_at: new Date().toISOString(),
              })
              .eq("id", order.customer_id);

            if (!repairError) {
              await supabase.from("logs").insert({
                action: "customer_location_repaired_from_superadmin_otp_delivery",
                entity: "customers",
                entity_id: order.customer_id,
                company_id: order.company_id,
                user_id: user.id,
                details: {
                  customer_name: order.customer_name,
                  order_id: order.id,
                  previous_distance_m: savedDistance,
                  new_latitude: Number(attempt.driver_lat),
                  new_longitude: Number(attempt.driver_lng),
                  source: "recent_blocked_repartidor_gps",
                  reason:
                    "Superadmin confirmed the physical delivery by OTP after a geofence block.",
                },
              });
            } else {
              console.warn("Could not self-heal customer location:", repairError);
            }
          }
        }
      }
    }

    await supabase
      .from("mark_delivered_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    return new Response(JSON.stringify({
      success: true,
      updated: updatedCount ?? orderIds.length,
      status: targetStatus,
      deliverySource: targetStatus === "delivered" ? "superadmin_otp" : null,
      deliveryNote: targetStatus === "delivered"
        ? "Entregado por Superadmin mediante OTP"
        : null,
    }), {
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
