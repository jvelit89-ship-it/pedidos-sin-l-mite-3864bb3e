import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    const { orderIds, targetStatus } = await req.json();
    const otpStatuses = ["delivery", "delivered", "cancelled", "backorder"];
    if (!Array.isArray(orderIds) || orderIds.length === 0 || !otpStatuses.includes(targetStatus)) {
      return new Response(JSON.stringify({ error: "orderIds requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: insertError } = await supabase
      .from("mark_delivered_otp_codes")
      .insert({
        user_id: user.id,
        otp_code: otp,
        order_ids: orderIds,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "No se pudo generar OTP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is missing");
      return new Response(JSON.stringify({ error: "RESEND_NOT_CONFIGURED" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const otpRecipient = Deno.env.get("MARK_DELIVERED_OTP_EMAIL") || "jvelit89@gmail.com";
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "Sistema de Pedidos <notificaciones@gestx.app>";

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: resendFrom,
      to: [otpRecipient],
      subject: `Código OTP para cambiar pedido(s) a ${targetStatus}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">🔐 Autorizar cambio de estado</h1>
          <p>Has solicitado cambiar <strong>${orderIds.length}</strong> pedido(s) al estado <strong>${targetStatus}</strong>.</p>
          <p>Tu código de verificación es:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Expira en 10 minutos. No compartas este código.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend send error:", emailError);
      return new Response(JSON.stringify({ error: "RESEND_SEND_FAILED", detail: emailError.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      emailId: emailData?.id ?? null,
      sentTo: otpRecipient.replace(/(^.).*(@.*$)/, "$1***$2"),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-mark-delivered-otp error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
