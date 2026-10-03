-- Distributor loyalty program for the public online ordering portal.
CREATE TABLE IF NOT EXISTS public.customer_loyalty_accounts (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_points_earned >= 0),
  lifetime_spend numeric(12,2) NOT NULL DEFAULT 0 CHECK (lifetime_spend >= 0),
  delivered_online_orders integer NOT NULL DEFAULT 0 CHECK (delivered_online_orders >= 0),
  first_online_bonus_awarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn','redeem','adjustment','reversal','bonus')),
  points integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_earn_per_order
  ON public.customer_loyalty_transactions(order_id, transaction_type)
  WHERE order_id IS NOT NULL AND transaction_type = 'earn';

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_bonus_per_order
  ON public.customer_loyalty_transactions(order_id, transaction_type)
  WHERE order_id IS NOT NULL AND transaction_type = 'bonus';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.customer_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_loyalty_accounts FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.customer_loyalty_transactions FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.apply_online_order_loyalty_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_points integer;
  bonus_points integer := 0;
  current_account public.customer_loyalty_accounts%ROWTYPE;
BEGIN
  IF NEW.status = 'delivered'
     AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.order_source = 'online'
     AND NEW.customer_id IS NOT NULL THEN

    INSERT INTO public.customer_loyalty_accounts(customer_id, company_id)
    VALUES (NEW.customer_id, NEW.company_id)
    ON CONFLICT (customer_id) DO NOTHING;

    SELECT * INTO current_account
    FROM public.customer_loyalty_accounts
    WHERE customer_id = NEW.customer_id
    FOR UPDATE;

    base_points := GREATEST(0, FLOOR(COALESCE(NEW.total, 0))::integer);

    IF NOT current_account.first_online_bonus_awarded THEN
      bonus_points := 20;
    END IF;

    INSERT INTO public.customer_loyalty_transactions(
      company_id, customer_id, order_id, transaction_type, points, description
    )
    VALUES (
      NEW.company_id, NEW.customer_id, NEW.id, 'earn', base_points,
      'Puntos por pedido online entregado'
    )
    ON CONFLICT DO NOTHING;

    IF bonus_points > 0 THEN
      INSERT INTO public.customer_loyalty_transactions(
        company_id, customer_id, order_id, transaction_type, points, description
      )
      VALUES (
        NEW.company_id, NEW.customer_id, NEW.id, 'bonus', bonus_points,
        'Bono de bienvenida por primer pedido online entregado'
      )
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.customer_loyalty_accounts
    SET
      points_balance = points_balance + base_points + bonus_points,
      lifetime_points_earned = lifetime_points_earned + base_points + bonus_points,
      lifetime_spend = lifetime_spend + COALESCE(NEW.total, 0),
      delivered_online_orders = delivered_online_orders + 1,
      first_online_bonus_awarded = first_online_bonus_awarded OR bonus_points > 0,
      updated_at = now()
    WHERE customer_id = NEW.customer_id;

    NEW.loyalty_points_earned := base_points + bonus_points;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_online_order_loyalty_on_delivery ON public.orders;
CREATE TRIGGER apply_online_order_loyalty_on_delivery
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_online_order_loyalty_on_delivery();

CREATE OR REPLACE FUNCTION public.apply_loyalty_redemption(
  p_customer_id uuid,
  p_order_id uuid,
  p_points integer
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  account_row public.customer_loyalty_accounts%ROWTYPE;
  discount_amount numeric(12,2);
  order_company uuid;
  order_customer uuid;
BEGIN
  IF p_points NOT IN (50, 100) THEN
    RAISE EXCEPTION 'INVALID_REWARD';
  END IF;

  discount_amount := CASE p_points
    WHEN 50 THEN 5.00
    WHEN 100 THEN 12.00
  END;

  SELECT company_id, customer_id
    INTO order_company, order_customer
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_customer IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'ORDER_CUSTOMER_MISMATCH';
  END IF;

  SELECT * INTO account_row
  FROM public.customer_loyalty_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF account_row.customer_id IS NULL OR account_row.points_balance < p_points THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  UPDATE public.customer_loyalty_accounts
  SET points_balance = points_balance - p_points,
      updated_at = now()
  WHERE customer_id = p_customer_id;

  UPDATE public.orders
  SET loyalty_points_redeemed = p_points,
      loyalty_discount_amount = discount_amount,
      total = GREATEST(0, total - discount_amount),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.customer_loyalty_transactions(
    company_id, customer_id, order_id, transaction_type, points, description
  )
  VALUES (
    order_company, p_customer_id, p_order_id, 'redeem', -p_points,
    CASE p_points
      WHEN 50 THEN 'Canje de 50 puntos por S/5 de descuento'
      WHEN 100 THEN 'Canje de 100 puntos por S/12 de descuento'
    END
  );

  RETURN discount_amount;
END;
$func$;

REVOKE ALL ON FUNCTION public.apply_loyalty_redemption(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_loyalty_redemption(uuid, uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
