-- Fast server-side aggregation for seller sales opportunities.
-- Replaces downloading the full customer/order/order_items history into the browser.
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
order_base AS (
  SELECT
    o.id,
    o.customer_id,
    ((o.created_at AT TIME ZONE 'America/Lima')::date) AS purchase_date,
    coalesce(o.total, 0)::numeric AS total
  FROM public.orders o
  JOIN current_seller s
    ON s.vendedor_id = o.vendedor_id
   AND s.company_id = o.company_id
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
    ob.customer_id,
    ob.purchase_date,
    sum(ob.total)::numeric AS total,
    sum(coalesce(ibo.units, 0))::numeric AS units
  FROM order_base ob
  LEFT JOIN item_by_order ibo ON ibo.order_id = ob.id
  GROUP BY ob.customer_id, ob.purchase_date
),
purchase_intervals AS (
  SELECT
    customer_id,
    purchase_date,
    purchase_date - lag(purchase_date) OVER (
      PARTITION BY customer_id
      ORDER BY purchase_date
    ) AS interval_days
  FROM purchase_days
),
purchase_stats AS (
  SELECT
    pd.customer_id,
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
    ON pi.customer_id = pd.customer_id
   AND pi.purchase_date = pd.purchase_date
  GROUP BY pd.customer_id
  HAVING count(*) >= 2
),
last_purchase AS (
  SELECT DISTINCT ON (pd.customer_id)
    pd.customer_id,
    pd.units AS last_purchase_units
  FROM purchase_days pd
  ORDER BY pd.customer_id, pd.purchase_date DESC
),
product_totals AS (
  SELECT
    ob.customer_id,
    oi.product_name,
    sum(oi.quantity)::numeric AS qty
  FROM order_base ob
  JOIN public.order_items oi ON oi.order_id = ob.id
  GROUP BY ob.customer_id, oi.product_name
),
favorite_products AS (
  SELECT
    ranked.customer_id,
    array_agg(ranked.product_name ORDER BY ranked.qty DESC, ranked.product_name)
      FILTER (WHERE ranked.rn <= 3) AS products
  FROM (
    SELECT
      pt.*,
      row_number() OVER (
        PARTITION BY pt.customer_id
        ORDER BY pt.qty DESC, pt.product_name
      ) AS rn
    FROM product_totals pt
  ) ranked
  WHERE ranked.rn <= 3
  GROUP BY ranked.customer_id
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
    c.id AS customer_id,
    c.name AS customer_name,
    c.phone,
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
  FROM purchase_stats ps
  JOIN public.customers c ON c.id = ps.customer_id
  LEFT JOIN last_purchase lp ON lp.customer_id = ps.customer_id
  LEFT JOIN favorite_products fp ON fp.customer_id = ps.customer_id
  LEFT JOIN latest_actions la ON la.customer_id = ps.customer_id
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
ORDER BY s.average_order_value DESC
LIMIT 300;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_followup_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_followup_opportunities() TO authenticated;

COMMENT ON FUNCTION public.get_customer_followup_opportunities() IS
  'Server-side seller opportunity calculation to keep the dashboard fast and avoid transferring full order history.';

NOTIFY pgrst, 'reload schema';
