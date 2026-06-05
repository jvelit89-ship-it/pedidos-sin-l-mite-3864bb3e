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

    const body = await req.json();
    const action = body.action as string;

    // -------------------- INIT --------------------
    if (action === "init") {
      let companyId = body.companyId as string | null;
      if (!companyId) {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .maybeSingle();
        companyId = data?.id ?? null;
      }
      if (!companyId) {
        return json({ error: "No company configured" }, 404);
      }

      const [comp, prods, vends, rules] = await Promise.all([
        supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
        supabase
          .from("products")
          .select("id, name, price, stock, image_url")
          .eq("company_id", companyId)
          .eq("product_type", "final"),
        supabase
          .from("vendedores")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("active", true),
        supabase
          .from("volume_pricing_rules")
          .select(
            "id, product_id, min_quantity, unit_price, promotion_days, is_online_exclusive",
          )
          .eq("company_id", companyId)
          .eq("is_active", true),
      ]);

      return json({
        company: comp.data,
        products: prods.data ?? [],
        vendedores: vends.data ?? [],
        pricingRules: rules.data ?? [],
      });
    }

    // -------------------- LOOKUP --------------------
    if (action === "lookup") {
      const documentId = String(body.documentId || "").trim();
      const companyId = body.companyId as string;
      if (!documentId || !companyId) {
        return json({ error: "documentId and companyId required" }, 400);
      }

      const { data: customer } = await supabase
        .from("customers")
        .select(
          "id, name, document_id, phone, address, customer_type, business_name",
        )
        .eq("document_id", documentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!customer) return json({ customer: null, prices: [] });

      const { data: prices } = await supabase
        .from("customer_product_prices")
        .select("product_id, unit_price")
        .eq("customer_id", customer.id)
        .eq("is_active", true);

      return json({ customer, prices: prices ?? [] });
    }

    // -------------------- SUBMIT --------------------
    if (action === "submit") {
      const {
        companyId,
        documentId,
        documentType,
        name,
        phone,
        address,
        vendedorId,
        isFactoryDirect,
        items,
      } = body as {
        companyId: string;
        documentId: string;
        documentType: "dni" | "ruc";
        name: string;
        phone?: string;
        address?: string;
        vendedorId?: string | null;
        isFactoryDirect: boolean;
        items: Array<{
          product_id: string;
          quantity: number;
          unit_price: number;
        }>;
      };

      if (!companyId || !documentId || !items?.length) {
        return json({ error: "Datos incompletos" }, 400);
      }
      // Basic input validation
      if (documentType === "dni" && !/^\d{8}$/.test(documentId)) {
        return json({ error: "DNI inválido" }, 400);
      }
      if (documentType === "ruc" && !/^\d{11}$/.test(documentId)) {
        return json({ error: "RUC inválido" }, 400);
      }
      const safeName = String(name || "Cliente Sin Nombre").slice(0, 200);
      const safePhone = String(phone || "").slice(0, 20);
      const safeAddress = String(address || "").slice(0, 500);

      // Upsert customer
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("document_id", documentId)
        .eq("company_id", companyId)
        .maybeSingle();

      let customerId: string;
      if (existing) {
        customerId = existing.id;
        await supabase
          .from("customers")
          .update({
            name: safeName,
            phone: safePhone,
            address: safeAddress,
          })
          .eq("id", customerId);
      } else {
        const { data: created, error: cErr } = await supabase
          .from("customers")
          .insert({
            company_id: companyId,
            document_id: documentId,
            name: safeName,
            phone: safePhone,
            address: safeAddress,
            customer_type: documentType === "ruc" ? "mayorista" : "minorista",
          })
          .select("id")
          .single();
        if (cErr) return json({ error: cErr.message }, 400);
        customerId = created.id;
      }

      // Re-validate prices/products server side
      const productIds = items.map((i) => i.product_id);
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds)
        .eq("company_id", companyId);
      if (!prods || prods.length !== productIds.length) {
        return json({ error: "Producto inválido" }, 400);
      }
      const productMap = new Map(prods.map((p) => [p.id, p]));

      const safeItems = items.map((i) => {
        const p = productMap.get(i.product_id)!;
        const qty = Math.max(1, Math.floor(Number(i.quantity) || 0));
        // Trust client unit_price only if not greater than base price; otherwise use base
        const unit =
          Number.isFinite(i.unit_price) && i.unit_price <= Number(p.price)
            ? Number(i.unit_price)
            : Number(p.price);
        return {
          product_id: p.id,
          product_name: p.name,
          quantity: qty,
          unit_price: unit,
          total: unit * qty,
        };
      });
      const total = safeItems.reduce((a, it) => a + it.total, 0);

      let vendedorName = "Directo de Fábrica";
      if (!isFactoryDirect && vendedorId) {
        const { data: v } = await supabase
          .from("vendedores")
          .select("name")
          .eq("id", vendedorId)
          .eq("company_id", companyId)
          .maybeSingle();
        vendedorName = v?.name || "Vendedor";
      }

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          company_id: companyId,
          customer_id: customerId,
          customer_name: safeName,
          total,
          status: "pending",
          order_source: "online",
          is_factory_direct: !!isFactoryDirect,
          delivery_address: safeAddress,
          vendedor_id: !isFactoryDirect ? vendedorId : null,
          vendedor_name: vendedorName,
        })
        .select("id, tracking_code")
        .single();
      if (oErr) return json({ error: oErr.message }, 400);

      const itemsWithOrder = safeItems.map((it) => ({
        ...it,
        order_id: order.id,
      }));
      const { error: iErr } = await supabase
        .from("order_items")
        .insert(itemsWithOrder);
      if (iErr) return json({ error: iErr.message }, 400);

      return json({ success: true, orderId: order.id, trackingCode: order.tracking_code });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("public-online-order error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
