import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSmsPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (/^\+\d{8,15}$/.test(compact)) return compact;
  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits.startsWith("51") ? digits : `51${digits}`}`;
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 6) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}

async function logNotification(
  service: ReturnType<typeof createClient>,
  orderId: string,
  channel: string,
  provider: string,
  status: string,
  destination: string,
  providerMessageId: string | null = null,
  error: string | null = null,
) {
  try {
    await service.from("delivery_pin_notifications").insert({
      order_id: orderId,
      channel,
      provider,
      status,
      destination_masked: maskPhone(destination),
      provider_message_id: providerMessageId,
      error,
    });
  } catch (logError) {
    console.warn("delivery_pin_notifications log failed", logError);
  }
}

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
    .select("id, company_id, customer_id, customer_name, customers(phone)")
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
    .select("pin")
    .eq("order_id", orderId)
    .maybeSingle();

  let pin = existing?.pin || "";
  if (!pin) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    pin = String(1000 + (bytes[0] % 9000));
    const { error } = await service.from("order_delivery_pins").insert({ order_id: orderId, pin });
    if (error) {
      return new Response(JSON.stringify({ success: false, error: "PIN_CREATE_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const customerRel = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const rawPhone = customerRel?.phone || "";
  const digits = rawPhone.replace(/\D/g, "");
  const phone = digits.startsWith("51") ? digits : `51${digits}`;
  const smsPhone = normalizeSmsPhone(rawPhone);

  if (!digits || !smsPhone) {
    return new Response(JSON.stringify({ success: false, error: "CUSTOMER_PHONE_REQUIRED" }), {
      status: 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderCode = String(order.id).slice(0, 8).toUpperCase();
  const message =
    `Hola ${order.customer_name}. Tu pedido #${orderCode} ha sido registrado.\n\n` +
    `🔐 Tu PIN privado de entrega es: *${pin}*\n\n` +
    "Guárdalo y no lo compartas antes de recibir tu pedido. Cuando el repartidor esté contigo, " +
    "verifica tus productos y recién en ese momento indícale este PIN para confirmar la entrega.";

  // Primary channel: httpSMS, reusing the same provider model as DentalCore.
  // Required Supabase secrets:
  // HTTPSMS_API_KEY, HTTPSMS_FROM_NUMBER
  // Optional: HTTPSMS_BASE_URL (defaults to https://api.httpsms.com)
  const httpSmsApiKey = Deno.env.get("HTTPSMS_API_KEY");
  const httpSmsFrom = normalizeSmsPhone(Deno.env.get("HTTPSMS_FROM_NUMBER") || "");
  const httpSmsBase = (Deno.env.get("HTTPSMS_BASE_URL") || "https://api.httpsms.com").replace(/\/$/, "");

  const smsMessage =
    `Santa María: pedido #${orderCode} registrado. Tu PIN privado de entrega es ${pin}. ` +
    "No lo compartas hasta recibir y verificar tus productos. Entrégalo al repartidor solo al momento de confirmar la entrega.";

  const failures: string[] = [];
  let provider = "";
  let channel = "";

  if (httpSmsApiKey && httpSmsFrom) {
    try {
      const requestId = crypto.randomUUID();
      const response = await fetch(`${httpSmsBase}/v1/messages/send`, {
        method: "POST",
        headers: {
          "x-api-key": httpSmsApiKey,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: httpSmsFrom,
          to: smsPhone,
          content: smsMessage,
          request_id: requestId,
        }),
        signal: AbortSignal.timeout(12000),
      });

      const raw = await response.text();
      if (response.ok) {
        let providerMessageId: string | null = null;
        try {
          const payload = JSON.parse(raw);
          providerMessageId = payload?.data?.id ? String(payload.data.id) : payload?.id ? String(payload.id) : null;
        } catch {
          providerMessageId = null;
        }
        provider = "httpsms";
        channel = "sms";
        await logNotification(service, orderId, channel, provider, "accepted", smsPhone, providerMessageId);
      } else {
        const reason = `HTTP ${response.status}: ${raw.replace(/\s+/g, " ").slice(0, 220)}`;
        failures.push(`httpsms: ${reason}`);
        await logNotification(service, orderId, "sms", "httpsms", "failed", smsPhone, null, reason);
      }
    } catch (error: any) {
      const reason = error?.message || "Error de red";
      failures.push(`httpsms: ${reason}`);
      await logNotification(service, orderId, "sms", "httpsms", "failed", smsPhone, null, reason.slice(0, 220));
    }
  }

  // Fallback 1: Evolution API / WhatsApp
  if (!provider) {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

    if (evolutionUrl && evolutionKey && evolutionInstance) {
      try {
        const response = await fetch(
          `${evolutionUrl}/message/sendText/${encodeURIComponent(evolutionInstance)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({ number: phone, text: message }),
            signal: AbortSignal.timeout(12000),
          },
        );
        if (response.ok) {
          provider = "evolution";
          channel = "whatsapp";
          await logNotification(service, orderId, channel, provider, "accepted", phone);
        } else {
          const raw = await response.text();
          const reason = `HTTP ${response.status}: ${raw.replace(/\s+/g, " ").slice(0, 220)}`;
          failures.push(`evolution: ${reason}`);
          await logNotification(service, orderId, "whatsapp", "evolution", "failed", phone, null, reason);
        }
      } catch (error: any) {
        const reason = error?.message || "Error de red";
        failures.push(`evolution: ${reason}`);
        await logNotification(service, orderId, "whatsapp", "evolution", "failed", phone, null, reason.slice(0, 220));
      }
    }
  }

  // Fallback 2: WhatsApp Cloud API template
  if (!provider) {
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
    const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "es_PE";

    if (accessToken && phoneNumberId && templateName) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "template",
              template: {
                name: templateName,
                language: { code: language },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: order.customer_name },
                      { type: "text", text: pin },
                      { type: "text", text: orderCode },
                    ],
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(12000),
          },
        );
        if (response.ok) {
          provider = "meta";
          channel = "whatsapp";
          await logNotification(service, orderId, channel, provider, "accepted", phone);
        } else {
          const raw = await response.text();
          const reason = `HTTP ${response.status}: ${raw.replace(/\s+/g, " ").slice(0, 220)}`;
          failures.push(`meta: ${reason}`);
          await logNotification(service, orderId, "whatsapp", "meta", "failed", phone, null, reason);
        }
      } catch (error: any) {
        const reason = error?.message || "Error de red";
        failures.push(`meta: ${reason}`);
        await logNotification(service, orderId, "whatsapp", "meta", "failed", phone, null, reason.slice(0, 220));
      }
    }
  }

  if (!provider) {
    const notConfigured =
      !httpSmsApiKey &&
      !Deno.env.get("EVOLUTION_API_URL") &&
      !Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    return new Response(
      JSON.stringify({
        success: false,
        error: notConfigured ? "PIN_DELIVERY_NOT_CONFIGURED" : "PIN_DELIVERY_FAILED",
        message: notConfigured
          ? "No hay un canal automático configurado para enviar el PIN."
          : "No se pudo entregar el PIN por SMS ni por WhatsApp.",
        attempts: failures.length,
      }),
      {
        status: notConfigured ? 503 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Never return the PIN to the browser.
  return new Response(JSON.stringify({
    success: true,
    provider,
    channel,
    destination: maskPhone(channel === "sms" ? smsPhone : phone),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
