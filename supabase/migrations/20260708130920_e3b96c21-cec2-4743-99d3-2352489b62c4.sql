
-- ------------------------------------------------------------------
-- 1. Address structure: add Block field to customers and addresses
-- ------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS block text;

-- ------------------------------------------------------------------
-- 2. Per-brand delivery fee + pickup enable
-- ------------------------------------------------------------------
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true;

-- Widen column grant for anon so storefront can read the fee/toggles
GRANT SELECT (
  brand_id, business_name, logo_url, currency,
  primary_color, text_color, background_color,
  font_family, font_url,
  cod_enabled, card_enabled, benefit_enabled, benefit_qr_url,
  footer_note,
  delivery_fee, pickup_enabled, delivery_enabled
) ON public.business_settings TO anon;

-- Refresh public settings view
DROP VIEW IF EXISTS public.brand_public_settings;
CREATE VIEW public.brand_public_settings
  WITH (security_invoker = on) AS
SELECT bs.brand_id, bs.business_name, bs.logo_url, bs.currency,
       bs.primary_color, bs.text_color, bs.background_color,
       bs.font_family, bs.font_url,
       bs.cod_enabled, bs.card_enabled, bs.benefit_enabled, bs.benefit_qr_url,
       bs.footer_note,
       bs.delivery_fee, bs.pickup_enabled, bs.delivery_enabled
FROM public.business_settings bs
JOIN public.brands b ON b.id = bs.brand_id
WHERE b.is_active = true;
GRANT SELECT ON public.brand_public_settings TO anon, authenticated;

-- ------------------------------------------------------------------
-- 3. Orders: fulfillment method
-- ------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery';
DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_method_check
    CHECK (fulfillment_method IN ('delivery','pickup'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------
-- 4. Link storefront shoppers to auth accounts
-- ------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);

-- Allow a signed-in shopper to read (and update) their own customer rows across brands.
DROP POLICY IF EXISTS "customer self read" ON public.customers;
CREATE POLICY "customer self read"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth_user_id IS NOT NULL AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS "customer self update" ON public.customers;
CREATE POLICY "customer self update"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())
  WITH CHECK (auth_user_id IS NOT NULL AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS "customer_address self read" ON public.customer_addresses;
CREATE POLICY "customer_address self read"
  ON public.customer_addresses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  ));

-- ------------------------------------------------------------------
-- 5. Developer Integrations table
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  base_url       text,
  api_key        text,
  webhook_secret text,
  is_active      boolean NOT NULL DEFAULT true,
  notes          text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations brand admin access" ON public.integration_credentials;
CREATE POLICY "integrations brand admin access"
  ON public.integration_credentials
  TO authenticated
  USING (public.is_admin() AND public.can_access_brand(brand_id))
  WITH CHECK (public.is_admin() AND public.can_access_brand(brand_id));

CREATE INDEX IF NOT EXISTS idx_integration_credentials_brand
  ON public.integration_credentials(brand_id);

DROP TRIGGER IF EXISTS trg_integration_credentials_updated ON public.integration_credentials;
CREATE TRIGGER trg_integration_credentials_updated
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------
-- 6. Brand delete RPC (soft by default, hard delete only when empty)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_brand(p_brand_id uuid, p_hard boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_order_count int;
  v_product_count int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can delete a brand';
  END IF;

  SELECT slug INTO v_slug FROM public.brands WHERE id = p_brand_id;
  IF v_slug IS NULL THEN RAISE EXCEPTION 'BRAND_NOT_FOUND'; END IF;

  IF p_hard THEN
    SELECT COUNT(*) INTO v_order_count FROM public.orders WHERE brand_id = p_brand_id;
    SELECT COUNT(*) INTO v_product_count FROM public.products WHERE brand_id = p_brand_id;
    IF v_order_count > 0 OR v_product_count > 0 THEN
      RAISE EXCEPTION 'BRAND_NOT_EMPTY';
    END IF;
    DELETE FROM public.brands WHERE id = p_brand_id;
    RETURN jsonb_build_object('deleted', true, 'mode', 'hard');
  ELSE
    UPDATE public.brands
      SET is_active = false,
          slug = v_slug || '-deleted-' || extract(epoch from now())::bigint
      WHERE id = p_brand_id;
    RETURN jsonb_build_object('deleted', true, 'mode', 'soft');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_brand(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_brand(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------------
-- 7. Link an authenticated shopper to the brand's customer row
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_storefront_customer(
  p_brand_slug text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_brand public.brands%ROWTYPE;
  v_owner uuid;
  v_customer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_brand FROM public.brands WHERE slug = p_brand_slug AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_NOT_FOUND'; END IF;
  SELECT COALESCE(v_brand.created_by,
                  (SELECT user_id FROM public.business_settings WHERE brand_id = v_brand.id LIMIT 1))
    INTO v_owner;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'NO_BRAND_OWNER'; END IF;

  -- 1) already linked?
  SELECT id INTO v_customer_id
    FROM public.customers
    WHERE brand_id = v_brand.id AND auth_user_id = v_uid
    LIMIT 1;

  -- 2) match by email
  IF v_customer_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_customer_id
      FROM public.customers
      WHERE brand_id = v_brand.id AND lower(email) = lower(v_email)
      LIMIT 1;
  END IF;

  -- 3) match by phone
  IF v_customer_id IS NULL AND p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    SELECT id INTO v_customer_id
      FROM public.customers
      WHERE brand_id = v_brand.id AND phone = p_phone
      LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, brand_id, name, phone, email, auth_user_id)
    VALUES (v_owner, v_brand.id,
            COALESCE(NULLIF(trim(p_name), ''), split_part(v_email, '@', 1), 'Guest'),
            NULLIF(trim(p_phone), ''),
            v_email,
            v_uid)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
      SET auth_user_id = v_uid,
          email = COALESCE(email, v_email),
          name  = COALESCE(NULLIF(trim(p_name), ''), name),
          phone = COALESCE(NULLIF(trim(p_phone), ''), phone)
      WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('customer_id', v_customer_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_storefront_customer(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_storefront_customer(text, text, text) TO authenticated;

-- ------------------------------------------------------------------
-- 8. Storefront checkout RPC — accept block + fulfillment + apply fee
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_storefront_order(
  p_brand_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_fulfillment text DEFAULT 'delivery'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand public.brands%ROWTYPE; v_settings public.business_settings%ROWTYPE;
  v_owner uuid; v_customer_id uuid; v_order_id uuid; v_invoice int;
  v_item jsonb; v_variant public.product_variants%ROWTYPE; v_product public.products%ROWTYPE;
  v_subtotal numeric(10,2) := 0; v_qty int; v_line_total numeric(10,2);
  v_phone text; v_email text; v_uid uuid := auth.uid();
  v_shipping numeric(10,2) := 0;
  v_address_id uuid;
  v_snapshot jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_brand FROM public.brands WHERE slug = p_brand_slug AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_NOT_FOUND'; END IF;

  SELECT * INTO v_settings FROM public.business_settings WHERE brand_id = v_brand.id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTINGS_NOT_FOUND'; END IF;

  IF p_payment_method NOT IN ('cod','card','benefit') THEN RAISE EXCEPTION 'INVALID_PAYMENT'; END IF;
  IF (p_payment_method = 'cod' AND NOT v_settings.cod_enabled)
     OR (p_payment_method = 'card' AND NOT v_settings.card_enabled)
     OR (p_payment_method = 'benefit' AND NOT v_settings.benefit_enabled) THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_DISABLED';
  END IF;

  IF p_fulfillment NOT IN ('delivery','pickup') THEN RAISE EXCEPTION 'INVALID_FULFILLMENT'; END IF;
  IF p_fulfillment = 'delivery' AND NOT v_settings.delivery_enabled THEN RAISE EXCEPTION 'DELIVERY_DISABLED'; END IF;
  IF p_fulfillment = 'pickup'   AND NOT v_settings.pickup_enabled   THEN RAISE EXCEPTION 'PICKUP_DISABLED'; END IF;

  IF p_fulfillment = 'delivery' THEN
    v_shipping := COALESCE(v_settings.delivery_fee, 0);
  END IF;

  v_owner := COALESCE(v_brand.created_by, v_settings.user_id);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'NO_BRAND_OWNER'; END IF;

  v_phone := NULLIF(trim(p_customer->>'phone'), '');
  v_email := NULLIF(trim(p_customer->>'email'), '');

  -- Match existing customer: signed-in user first, then phone, then email
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_customer_id
      FROM public.customers
      WHERE brand_id = v_brand.id AND auth_user_id = v_uid
      LIMIT 1;
  END IF;
  IF v_customer_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.customers
      WHERE brand_id = v_brand.id AND phone = v_phone LIMIT 1;
  END IF;
  IF v_customer_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.customers
      WHERE brand_id = v_brand.id AND lower(email) = lower(v_email) LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      user_id, brand_id, auth_user_id, name, phone, email,
      region, block, road, house, flat, city, address
    ) VALUES (
      v_owner, v_brand.id, v_uid,
      COALESCE(NULLIF(trim(p_customer->>'name'), ''), 'Guest'),
      v_phone, v_email,
      NULLIF(trim(p_customer->>'region'), ''),
      NULLIF(trim(p_customer->>'block'), ''),
      NULLIF(trim(p_customer->>'road'), ''),
      NULLIF(trim(p_customer->>'house'), ''),
      NULLIF(trim(p_customer->>'flat'), ''),
      NULLIF(trim(p_customer->>'city'), ''),
      NULLIF(trim(p_customer->>'address'), '')
    ) RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET
      auth_user_id = COALESCE(auth_user_id, v_uid),
      name    = COALESCE(NULLIF(trim(p_customer->>'name'), ''), name),
      phone   = COALESCE(v_phone, phone),
      email   = COALESCE(v_email, email),
      region  = COALESCE(NULLIF(trim(p_customer->>'region'), ''), region),
      block   = COALESCE(NULLIF(trim(p_customer->>'block'), ''), block),
      road    = COALESCE(NULLIF(trim(p_customer->>'road'), ''), road),
      house   = COALESCE(NULLIF(trim(p_customer->>'house'), ''), house),
      flat    = COALESCE(NULLIF(trim(p_customer->>'flat'), ''), flat),
      city    = COALESCE(NULLIF(trim(p_customer->>'city'), ''), city),
      address = COALESCE(NULLIF(trim(p_customer->>'address'), ''), address)
    WHERE id = v_customer_id;
  END IF;

  -- Persist a saved address record for delivery orders (structured Bahraini fields)
  IF p_fulfillment = 'delivery'
     AND ( NULLIF(trim(p_customer->>'region'), '') IS NOT NULL
        OR NULLIF(trim(p_customer->>'road'), '')   IS NOT NULL
        OR NULLIF(trim(p_customer->>'block'), '')  IS NOT NULL
        OR NULLIF(trim(p_customer->>'house'), '')  IS NOT NULL) THEN
    INSERT INTO public.customer_addresses (
      user_id, brand_id, customer_id, label,
      region, block, road, house, flat, is_default
    ) VALUES (
      v_owner, v_brand.id, v_customer_id,
      COALESCE(NULLIF(trim(p_customer->>'label'), ''), 'Home'),
      NULLIF(trim(p_customer->>'region'), ''),
      NULLIF(trim(p_customer->>'block'), ''),
      NULLIF(trim(p_customer->>'road'), ''),
      NULLIF(trim(p_customer->>'house'), ''),
      NULLIF(trim(p_customer->>'flat'), ''),
      NOT EXISTS (SELECT 1 FROM public.customer_addresses WHERE customer_id = v_customer_id)
    ) RETURNING id INTO v_address_id;
  END IF;

  v_invoice := v_settings.next_invoice_number;
  UPDATE public.business_settings SET next_invoice_number = next_invoice_number + 1
    WHERE brand_id = v_brand.id;

  INSERT INTO public.orders (
    user_id, brand_id, customer_id, invoice_number, status,
    payment_method, payment_status, currency, notes, channel,
    fulfillment_method, shipping_address_id, shipping
  ) VALUES (
    v_owner, v_brand.id, v_customer_id, v_invoice, 'pending',
    p_payment_method, 'unpaid', v_settings.currency, p_notes, 'storefront',
    p_fulfillment, v_address_id, v_shipping
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT * INTO v_variant FROM public.product_variants WHERE id = (v_item->>'variant_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_variant.brand_id <> v_brand.id THEN RAISE EXCEPTION 'VARIANT_NOT_FOUND'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
    IF NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_INACTIVE'; END IF;
    IF v_variant.stock_main < v_qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_variant.id; END IF;

    v_line_total := (v_variant.selling_price * v_qty)::numeric(10,2);
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO public.order_items (user_id, brand_id, order_id, product_id, variant_id,
      description, quantity, unit_price, line_total, location)
    VALUES (v_owner, v_brand.id, v_order_id, v_product.id, v_variant.id,
      COALESCE(v_product.name, 'Product'), v_qty, v_variant.selling_price, v_line_total, 'main');

    UPDATE public.product_variants SET stock_main = stock_main - v_qty WHERE id = v_variant.id;
    v_snapshot := v_snapshot || jsonb_build_object(v_variant.id::text || '|main', v_qty);
  END LOOP;

  UPDATE public.orders SET subtotal = v_subtotal, total = v_subtotal + v_shipping,
    stock_deducted = true, stock_snapshot = v_snapshot
  WHERE id = v_order_id;

  RETURN jsonb_build_object('order_id', v_order_id, 'invoice_number', v_invoice);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_storefront_order(text, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_storefront_order(text, jsonb, jsonb, text, text, text) TO anon, authenticated;
