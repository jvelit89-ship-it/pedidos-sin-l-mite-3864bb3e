-- Keep Oportunidades de Venta synchronized with the real customer/order history.
-- Fixes two causes of stale follow-up data:
-- 1) purchase history was restricted to orders created by the currently logged-in seller;
-- 2) duplicate customer records could split the same customer's order history.
--
-- Ownership is now taken from customers.vendedor_id (the current assigned seller),
-- while purchase behavior uses ALL non-cancelled company orders belonging to that
-- customer identity, regardless of which seller created the order.

CREATE OR REPLACE FUNCTION public.get_customer_followup_opportunities()
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  phone text,
  status text,
  average_days_between_purchases integer,
  last_purchase_date date,
  next_estimated_purchase_date date,
  days_to_estimated_purchase integer,
  average_order_value numeric,
  average_units_per_purchase numeric,
  last_purchase_units numeric,
  favorite_products text[],
  purchase_count integer,
  last_action_type text,
  last_action_at timestamptz,
  last_action_note text,
  snoozed_until date
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH current_seller AS (
  SELECT v.id AS vendedor_id, v.company_id
  FROM public.vendedores v
  WHERE v.user_id = auth.uid()
    AND coalesce(v.active, true) = true
  LIMIT 1
),
customer_identities AS (
  SELECT
    c.id,
    c.company_id,
    c.vendedor_id,
    c.name,
    c.phone,
    c.address,
    c.document_id,
    CASE
      WHEN nullif(trim(c.document_id), '') IS NOT NULL
       AND upper(trim(c.document_id)) NOT LIKE 'MISSING-%'
        THEN 'doc:' || regexp_replace(c.document_id, '[^0-9A-Za-z]', '', 'g')
      WHEN length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')) >= 7
        THEN 'phone:' || regexp_replace(c.phone, '[^0-9]', '', 'g')
      ELSE
        'nameaddr:' ||
        lower(regexp_replace(trim(coalesce(c.name, '')), '[^[:alnum:]]+', '', 'g')) ||
        '|' ||
        lower(regexp_replace(trim(coalesce(c.address, '')), '[^[:alnum:]]+', '', 'g'))
    END AS identity_key
  FROM public.customers c
  JOIN current_seller s ON s.company_id = c.company_id
),
seller_customers AS (
  SELECT ci.*
  FROM customer_identities ci
  JOIN current_seller s ON s.company_id = ci.company_id
  LEFT JOIN LATERAL (
    SELECT o.vendedor_id
    FROM public.orders o
    WHERE o.customer_id = ci.id
      AND o.company_id = ci.company_id
      AND o.status <> 'cancelled'::public.order_status
      AND o.vendedor_id IS NOT NULL
    ORDER BY coalesce(o.delivered_at, o.created_at) DESC, o.created_at DESC
    LIMIT 1
  ) latest_owner ON true
  WHERE coalesce(ci.vendedor_id, latest_owner.vendedor_id) = s.vendedor_id
),
seller_identity_keys AS (
  SELECT DISTINCT identity_key
  FROM seller_customers
),
identity_members AS (
  SELECT ci.id AS customer_member_id, ci.identity_key
  FROM customer_identities ci
  JOIN seller_identity_keys sik ON sik.identity_key = ci.identity_key
),
order_base AS (
  SELECT
    o.id,
    im.identity_key,
    ((o.created_at AT TIME ZONE 'America/Lima')::date) AS purchase_date,
    coalesce(o.total, 0)::numeric AS total
  FROM public.orders o
  JOIN current_seller s ON s.company_id = o.company_id
  JOIN identity_members im ON im.customer_member_id = o.customer_id
  WHERE o.status <> 'cancelled'::public.order_status
    AND o.customer_id IS NOT NULL
),
item_by_order AS (
  SELECT
    oi.order_id,
    coalesce(sum(oi.quantity), 0)::numeric AS units
  FROM public.order_items oi
  JOIN order_base ob ON ob.id = oi.order_id
  GROUP BY oi.order_id
),
purchase_days AS (
  SELECT
    ob.identity_key,
    ob.purchase_date,
    sum(ob.total)::numeric AS total,
    sum(coalesce(ibo.units, 0))::numeric AS units
  FROM order_base ob
  LEFT JOIN item_by_order ibo ON ibo.order_id = ob.id
  GROUP BY ob.identity_key, ob.purchase_date
),
purchase_intervals AS (
  SELECT
    identity_key,
    purchase_date,
    purchase_date - lag(purchase_date) OVER (
      PARTITION BY identity_key
      ORDER BY purchase_date
    ) AS interval_days
  FROM purchase_days
),
purchase_stats AS (
  SELECT
    pd.identity_key,
    count(*)::integer AS purchase_count,
    greatest(
      1,
      round(avg(pi.interval_days) FILTER (WHERE pi.interval_days IS NOT NULL))::integer
    ) AS average_days,
    avg(pd.total)::numeric AS average_order_value,
    avg(pd.units)::numeric AS average_units,
    max(pd.purchase_date) AS last_purchase_date
  FROM purchase_days pd
  LEFT JOIN purchase_intervals pi
    ON pi.identity_key = pd.identity_key
   AND pi.purchase_date = pd.purchase_date
  GROUP BY pd.identity_key
  HAVING count(*) >= 2
),
last_purchase AS (
  SELECT DISTINCT ON (pd.identity_key)
    pd.identity_key,
    pd.units AS last_purchase_units
  FROM purchase_days pd
  ORDER BY pd.identity_key, pd.purchase_date DESC
),
product_totals AS (
  SELECT
    ob.identity_key,
    oi.product_name,
    sum(oi.quantity)::numeric AS qty
  FROM order_base ob
  JOIN public.order_items oi ON oi.order_id = ob.id
  GROUP BY ob.identity_key, oi.product_name
),
favorite_products AS (
  SELECT
    ranked.identity_key,
    array_agg(ranked.product_name ORDER BY ranked.qty DESC, ranked.product_name)
      FILTER (WHERE ranked.rn <= 3) AS products
  FROM (
    SELECT
      pt.*,
      row_number() OVER (
        PARTITION BY pt.identity_key
        ORDER BY pt.qty DESC, pt.product_name
      ) AS rn
    FROM product_totals pt
  ) ranked
  WHERE ranked.rn <= 3
  GROUP BY ranked.identity_key
),
latest_actions AS (
  SELECT DISTINCT ON (a.customer_id)
    a.customer_id,
    a.action_type,
    a.note,
    a.snoozed_until,
    a.created_at
  FROM public.customer_followup_actions a
  JOIN current_seller s ON s.vendedor_id = a.vendedor_id
  WHERE a.created_at >= now() - interval '45 days'
  ORDER BY a.customer_id, a.created_at DESC
),
scored AS (
  SELECT
    sc.id AS customer_id,
    sc.name AS customer_name,
    sc.phone,
    ps.average_days,
    ps.average_order_value,
    ps.average_units,
    ps.last_purchase_date,
    lp.last_purchase_units,
    coalesce(fp.products, ARRAY[]::text[]) AS favorite_products,
    ps.purchase_count,
    (ps.last_purchase_date + ps.average_days) AS next_estimated_date,
    ((ps.last_purchase_date + ps.average_days) - (now() AT TIME ZONE 'America/Lima')::date)::integer AS days_to_estimated,
    greatest(2, least(7, round(ps.average_days * 0.25)::integer)) AS upcoming_window,
    greatest(7, round(ps.average_days * 0.5)::integer) AS risk_threshold,
    la.action_type,
    la.note,
    la.snoozed_until,
    la.created_at AS action_created_at
  FROM seller_customers sc
  JOIN purchase_stats ps ON ps.identity_key = sc.identity_key
  LEFT JOIN last_purchase lp ON lp.identity_key = sc.identity_key
  LEFT JOIN favorite_products fp ON fp.identity_key = sc.identity_key
  LEFT JOIN latest_actions la ON la.customer_id = sc.id
)
SELECT
  s.customer_id,
  s.customer_name,
  s.phone,
  CASE
    WHEN s.days_to_estimated >= 0
     AND s.days_to_estimated <= s.upcoming_window THEN 'upcoming'
    WHEN s.days_to_estimated < 0
     AND abs(s.days_to_estimated) > s.risk_threshold THEN 'risk'
    WHEN s.days_to_estimated < 0 THEN 'overdue'
    ELSE NULL
  END AS status,
  s.average_days AS average_days_between_purchases,
  s.last_purchase_date,
  s.next_estimated_date AS next_estimated_purchase_date,
  s.days_to_estimated AS days_to_estimated_purchase,
  round(s.average_order_value, 2) AS average_order_value,
  round(s.average_units, 1) AS average_units_per_purchase,
  coalesce(s.last_purchase_units, 0) AS last_purchase_units,
  s.favorite_products,
  s.purchase_count,
  s.action_type AS last_action_type,
  s.action_created_at AS last_action_at,
  s.note AS last_action_note,
  s.snoozed_until
FROM scored s
WHERE (
  (s.days_to_estimated >= 0 AND s.days_to_estimated <= s.upcoming_window)
  OR s.days_to_estimated < 0
)
ORDER BY
  CASE
    WHEN s.days_to_estimated < 0 THEN 0
    ELSE 1
  END,
  s.days_to_estimated ASC,
  s.average_order_value DESC
LIMIT 300;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_followup_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_followup_opportunities() TO authenticated;

COMMENT ON FUNCTION public.get_customer_followup_opportunities() IS
  'Synchronized sales opportunities: uses customers.vendedor_id when assigned, otherwise the most recent order seller, and complete customer order history for behavior.';

NOTIFY pgrst, 'reload schema';
