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

      const [{ data: prices }, { data: loyalty }, { data: lastOrder }] = await Promise.all([
        supabase
          .from("customer_product_prices")
          .select("product_id, unit_price")
          .eq("customer_id", customer.id)
          .eq("is_active", true),
        supabase
          .from("customer_loyalty_accounts")
          .select("points_balance, lifetime_points_earned, lifetime_spend, delivered_online_orders")
          .eq("customer_id", customer.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id, total, created_at, order_items(product_id, product_name, quantity)")
          .eq("customer_id", customer.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const points = Number(loyalty?.points_balance || 0);
      const lifetimeSpend = Number(loyalty?.lifetime_spend || 0);
      const level = lifetimeSpend >= 5000 ? "Oro" : lifetimeSpend >= 2000 ? "Plata" : "Bronce";
      const nextRewardPoints = points < 50 ? 50 : points < 100 ? 100 : null;

      return json({
        customer,
        prices: prices ?? [],
        loyalty: {
          points,
          lifetimePoints: Number(loyalty?.lifetime_points_earned || 0),
          lifetimeSpend,
          deliveredOnlineOrders: Number(loyalty?.delivered_online_orders || 0),
          level,
          nextRewardPoints,
        },
        lastOrder: lastOrder ?? null,
      });
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
        redeemPoints,
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
        redeemPoints?: number;
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

      // The server is authoritative for prices. Never trust unit_price sent by
      // the public browser.
      const [{ data: customerPrices }, { data: pricingRules }] = await Promise.all([
        supabase
          .from("customer_product_prices")
          .select("product_id, unit_price")
          .eq("customer_id", customerId)
          .eq("is_active", true)
          .in("product_id", productIds),
        supabase
          .from("volume_pricing_rules")
          .select("product_id, min_quantity, unit_price, promotion_days, is_online_exclusive")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .in("product_id", productIds),
      ]);

      const customerPriceMap = new Map(
        (customerPrices || []).map((price) => [price.product_id, Number(price.unit_price)]),
      );
      const activeRules = pricingRules || [];
      const limaDay = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCDay();

      const safeItems = items.map((i) => {
        const p = productMap.get(i.product_id)!;
        const qty = Math.max(1, Math.floor(Number(i.quantity) || 0));
        let unit = Number(p.price);

        const customerPrice = customerPriceMap.get(i.product_id);
        if (customerPrice !== undefined) {
          unit = customerPrice;
        } else {
          const applicableRules = activeRules
            .filter((rule) => {
              if (rule.product_id !== i.product_id) return false;
              const days = Array.isArray(rule.promotion_days) ? rule.promotion_days : [];
              if (days.length > 0 && !days.includes(limaDay)) return false;
              return qty >= Number(rule.min_quantity);
            })
            .sort((a, b) => {
              const aHasDays = Array.isArray(a.promotion_days) && a.promotion_days.length > 0;
              const bHasDays = Array.isArray(b.promotion_days) && b.promotion_days.length > 0;
              if (aHasDays && !bHasDays) return -1;
              if (!aHasDays && bHasDays) return 1;
              if (a.is_online_exclusive && !b.is_online_exclusive) return -1;
              if (!a.is_online_exclusive && b.is_online_exclusive) return 1;
              return Number(b.min_quantity) - Number(a.min_quantity);
            });

          if (applicableRules.length > 0) {
            unit = Number(applicableRules[0].unit_price);
          }
        }

        if (!Number.isFinite(unit) || unit < 0) {
          throw new Error("Precio inválido");
        }

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

      let loyaltyDiscount = 0;
      const requestedRedeemPoints = Number(redeemPoints || 0);
      if (requestedRedeemPoints > 0) {
        const { data: discount, error: redeemError } = await supabase.rpc(
          "apply_loyalty_redemption",
          {
            p_customer_id: customerId,
            p_order_id: order.id,
            p_points: requestedRedeemPoints,
          },
        );

        if (redeemError) {
          console.error("Loyalty redemption error:", redeemError);
          await supabase.from("order_items").delete().eq("order_id", order.id);
          await supabase.from("orders").delete().eq("id", order.id);
          return json({
            error: redeemError.message.includes("INSUFFICIENT_POINTS")
              ? "No tienes puntos suficientes para esa recompensa."
              : "No se pudo aplicar la recompensa. Intenta nuevamente.",
          }, 400);
        }
        loyaltyDiscount = Number(discount || 0);
      }

      const [{ data: finalOrder }, { data: loyaltyAfter }] = await Promise.all([
        supabase
          .from("orders")
          .select("total, loyalty_points_redeemed, loyalty_discount_amount")
          .eq("id", order.id)
          .single(),
        supabase
          .from("customer_loyalty_accounts")
          .select("points_balance")
          .eq("customer_id", customerId)
          .maybeSingle(),
      ]);

      return json({
        success: true,
        orderId: order.id,
        trackingCode: order.tracking_code,
        total: Number(finalOrder?.total ?? total),
        loyaltyDiscount,
        pointsRemaining: Number(loyaltyAfter?.points_balance || 0),
        projectedPoints: Math.max(0, Math.floor(Number(finalOrder?.total ?? total) / 5)),
      });
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
