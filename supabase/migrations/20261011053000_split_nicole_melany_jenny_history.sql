DO $$
DECLARE
  nicole_id uuid := '7a4ba222-eaf6-4bd8-bf2e-67f836158de6'::uuid;
  jenny_id uuid;
BEGIN
  SELECT id INTO jenny_id
  FROM public.customers
  WHERE company_id='00000000-0000-0000-0000-000000000001'::uuid
    AND lower(trim(name))='jenny julca'
  LIMIT 1;

  IF jenny_id IS NULL THEN
    INSERT INTO public.customers(
      name,address,notes,company_id,created_at,updated_at,
      vendedor_id,customer_type,document_id
    )
    VALUES (
      'Jenny Julca',
      'Socabaya 149, Barranca, Lima, Perú',
      'Registro reconstruido para separar historial histórico que estaba vinculado por error al cliente Nicole Melany.',
      '00000000-0000-0000-0000-000000000001'::uuid,
      '2026-01-26 17:00:00+00',
      now(),
      'de4eb316-fb25-458b-9d1c-ac0168dbd721'::uuid,
      'mayorista'::public.customer_type,
      'MISSING-' || gen_random_uuid()::text
    )
    RETURNING id INTO jenny_id;
  END IF;

  UPDATE public.orders
  SET customer_id=jenny_id,updated_at=now()
  WHERE customer_id=nicole_id
    AND lower(trim(customer_name))='jenny julca';

  UPDATE public.customer_prepaid_packages
  SET customer_id=jenny_id,updated_at=now()
  WHERE customer_id=nicole_id
    AND created_at<'2026-07-20'::timestamptz;
END
$$;

NOTIFY pgrst,'reload schema';
