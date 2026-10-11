CREATE OR REPLACE FUNCTION public.get_customer_followup_opportunities()
RETURNS TABLE(customer_id uuid,customer_name text,phone text,status text,average_days_between_purchases integer,last_purchase_date date,next_estimated_purchase_date date,days_to_estimated_purchase integer,average_order_value numeric,average_units_per_purchase numeric,last_purchase_units numeric,favorite_products text[],purchase_count integer,last_action_type text,last_action_at timestamptz,last_action_note text,snoozed_until date)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $f$
WITH s AS (
 SELECT id vendedor_id,company_id FROM public.vendedores
 WHERE user_id=auth.uid() AND coalesce(active,true)=true LIMIT 1
),c AS (
 SELECT c.id,c.name,c.phone FROM public.customers c JOIN s ON s.company_id=c.company_id
 WHERE c.vendedor_id=s.vendedor_id
),o AS (
 SELECT o.id,o.customer_id,(o.created_at AT TIME ZONE 'America/Lima')::date d,coalesce(o.total,0)::numeric total
 FROM public.orders o JOIN c ON c.id=o.customer_id WHERE o.status<>'cancelled'::public.order_status
),u AS (
 SELECT oi.order_id,sum(oi.quantity)::numeric units FROM public.order_items oi JOIN o ON o.id=oi.order_id GROUP BY oi.order_id
),pd AS (
 SELECT o.customer_id,o.d,sum(o.total)::numeric total,sum(coalesce(u.units,0))::numeric units
 FROM o LEFT JOIN u ON u.order_id=o.id GROUP BY o.customer_id,o.d
),r AS (
 SELECT pd.*,row_number() OVER(PARTITION BY customer_id ORDER BY d DESC) rn,count(*) OVER(PARTITION BY customer_id)::integer pc FROM pd
),rr AS (SELECT * FROM r WHERE rn<=12),
g AS (
 SELECT customer_id,d,d-lag(d) OVER(PARTITION BY customer_id ORDER BY d) gap FROM rr
),st AS (
 SELECT rr.customer_id,max(rr.pc)::integer pc,
 greatest(1,round(avg(g.gap) FILTER(WHERE g.gap IS NOT NULL))::integer) avgd,
 avg(rr.total)::numeric avgv,avg(rr.units)::numeric avgu,max(rr.d) lastd
 FROM rr LEFT JOIN g USING(customer_id,d) GROUP BY rr.customer_id HAVING max(rr.pc)>=2
),ld AS (
 SELECT DISTINCT ON(customer_id) customer_id,units FROM pd ORDER BY customer_id,d DESC
),pt AS (
 SELECT o.customer_id,oi.product_name,sum(oi.quantity)::numeric qty
 FROM o JOIN rr ON rr.customer_id=o.customer_id AND rr.d=o.d
 JOIN public.order_items oi ON oi.order_id=o.id GROUP BY o.customer_id,oi.product_name
),fp AS (
 SELECT customer_id,array_agg(product_name ORDER BY qty DESC,product_name) FILTER(WHERE rn<=3) products
 FROM (SELECT pt.*,row_number() OVER(PARTITION BY customer_id ORDER BY qty DESC,product_name) rn FROM pt)x
 WHERE rn<=3 GROUP BY customer_id
),a AS (
 SELECT DISTINCT ON(a.customer_id) a.customer_id,a.action_type,a.note,a.snoozed_until,a.created_at
 FROM public.customer_followup_actions a JOIN s ON s.vendedor_id=a.vendedor_id
 WHERE a.created_at>=now()-interval '45 days' ORDER BY a.customer_id,a.created_at DESC
),x AS (
 SELECT c.id,c.name,c.phone,st.avgd,st.avgv,st.avgu,st.lastd,ld.units,
 coalesce(fp.products,ARRAY[]::text[]) products,st.pc,st.lastd+st.avgd nextd,
 ((st.lastd+st.avgd)-(now() AT TIME ZONE 'America/Lima')::date)::integer dto,
 greatest(2,least(7,round(st.avgd*.25)::integer)) uw,greatest(7,round(st.avgd*.5)::integer) rt,
 a.action_type,a.note,a.snoozed_until,a.created_at aa
 FROM c JOIN st ON st.customer_id=c.id LEFT JOIN ld ON ld.customer_id=c.id
 LEFT JOIN fp ON fp.customer_id=c.id LEFT JOIN a ON a.customer_id=c.id
)
SELECT id,name,phone,
 CASE WHEN dto>=0 AND dto<=uw THEN 'upcoming' WHEN dto<0 AND abs(dto)>rt THEN 'risk' WHEN dto<0 THEN 'overdue' END,
 avgd,lastd,nextd,dto,round(avgv,2),round(avgu,1),coalesce(units,0),products,pc,action_type,aa,note,snoozed_until
FROM x WHERE (dto>=0 AND dto<=uw) OR dto<0
ORDER BY CASE WHEN dto<0 THEN 0 ELSE 1 END,dto,avgv DESC LIMIT 300;
$f$;
REVOKE ALL ON FUNCTION public.get_customer_followup_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_followup_opportunities() TO authenticated;
NOTIFY pgrst,'reload schema';
