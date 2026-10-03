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

  if (!digits) {
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

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

  let provider = "";

  if (evolutionUrl && evolutionKey && evolutionInstance) {
    const response = await fetch(
      `${evolutionUrl}/message/sendText/${encodeURIComponent(evolutionInstance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({ number: phone, text: message }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("Evolution API delivery PIN send failed:", response.status, body.slice(0, 300));
      return new Response(JSON.stringify({ success: false, error: "WHATSAPP_SEND_FAILED" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    provider = "evolution";
  } else {
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
    const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "es_PE";

    if (!accessToken || !phoneNumberId || !templateName) {
      return new Response(JSON.stringify({ success: false, error: "WHATSAPP_NOT_CONFIGURED" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("WhatsApp Cloud API delivery PIN send failed:", response.status, body.slice(0, 300));
      return new Response(JSON.stringify({ success: false, error: "WHATSAPP_SEND_FAILED" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    provider = "meta";
  }

  return new Response(JSON.stringify({ success: true, provider }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
