
-- Multi-location inventory columns
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS stock_main integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_incubator integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode text;

-- Backfill: move existing stock into main location
UPDATE public.product_variants
   SET stock_main = COALESCE(stock, 0)
 WHERE stock_main = 0 AND COALESCE(stock, 0) <> 0;

-- Keep aggregate stock in sync with per-location stocks
CREATE OR REPLACE FUNCTION public.product_variants_sync_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.stock := COALESCE(NEW.stock_main, 0) + COALESCE(NEW.stock_incubator, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_variants_sync_stock ON public.product_variants;
CREATE TRIGGER trg_product_variants_sync_stock
  BEFORE INSERT OR UPDATE OF stock_main, stock_incubator
  ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_sync_stock();

-- Ensure aggregate reflects current per-location values for existing rows
UPDATE public.product_variants
   SET stock_main = stock_main;

-- Unique barcode per user (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_user_barcode_uniq
  ON public.product_variants (user_id, barcode)
  WHERE barcode IS NOT NULL;

-- Order line location
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'main';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_location_check'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_location_check
      CHECK (location IN ('main','incubator'));
  END IF;
END $$;

-- Rewrite stock sync: deduct/restore per (variant, location)
CREATE OR REPLACE FUNCTION public.sync_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_deducting boolean;
  v_snapshot jsonb;
  r RECORD;
  k text;
  val int;
  v_variant uuid;
  v_loc text;
  v_avail int;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  v_deducting := v_order.status IN ('confirmed','paid','shipped','completed');

  -- Restore any previously-deducted quantities from snapshot
  IF v_order.stock_deducted AND v_order.stock_snapshot IS NOT NULL THEN
    FOR k, val IN SELECT * FROM jsonb_each_text(v_order.stock_snapshot) LOOP
      IF position('|' in k) > 0 THEN
        v_variant := split_part(k,'|',1)::uuid;
        v_loc := split_part(k,'|',2);
      ELSE
        v_variant := k::uuid;
        v_loc := 'main';
      END IF;
      IF v_loc = 'incubator' THEN
        UPDATE public.product_variants SET stock_incubator = stock_incubator + val WHERE id = v_variant;
      ELSE
        UPDATE public.product_variants SET stock_main = stock_main + val WHERE id = v_variant;
      END IF;
    END LOOP;
    UPDATE public.orders SET stock_deducted = false, stock_snapshot = NULL WHERE id = p_order_id;
  END IF;

  IF v_deducting THEN
    v_snapshot := '{}'::jsonb;
    FOR r IN
      SELECT variant_id, COALESCE(location,'main') AS loc, SUM(quantity)::int AS qty
      FROM public.order_items
      WHERE order_id = p_order_id AND variant_id IS NOT NULL
      GROUP BY variant_id, COALESCE(location,'main')
    LOOP
      IF r.loc = 'incubator' THEN
        SELECT stock_incubator INTO v_avail FROM public.product_variants WHERE id = r.variant_id FOR UPDATE;
      ELSE
        SELECT stock_main INTO v_avail FROM public.product_variants WHERE id = r.variant_id FOR UPDATE;
      END IF;
      IF v_avail IS NULL OR v_avail < r.qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', r.variant_id;
      END IF;
      IF r.loc = 'incubator' THEN
        UPDATE public.product_variants SET stock_incubator = stock_incubator - r.qty WHERE id = r.variant_id;
      ELSE
        UPDATE public.product_variants SET stock_main = stock_main - r.qty WHERE id = r.variant_id;
      END IF;
      v_snapshot := v_snapshot || jsonb_build_object(r.variant_id::text || '|' || r.loc, r.qty);
    END LOOP;
    UPDATE public.orders SET stock_deducted = true, stock_snapshot = v_snapshot WHERE id = p_order_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_order_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_order_stock(uuid) TO authenticated, service_role;

-- Update delete-restore trigger to be location-aware
CREATE OR REPLACE FUNCTION public.orders_restore_stock_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_variant uuid;
  v_loc text;
BEGIN
  IF OLD.stock_deducted THEN
    IF OLD.stock_snapshot IS NOT NULL THEN
      FOR r IN SELECT key, value FROM jsonb_each_text(OLD.stock_snapshot) LOOP
        IF position('|' in r.key) > 0 THEN
          v_variant := split_part(r.key,'|',1)::uuid;
          v_loc := split_part(r.key,'|',2);
        ELSE
          v_variant := r.key::uuid;
          v_loc := 'main';
        END IF;
        IF v_loc = 'incubator' THEN
          UPDATE public.product_variants SET stock_incubator = stock_incubator + r.value::int WHERE id = v_variant;
        ELSE
          UPDATE public.product_variants SET stock_main = stock_main + r.value::int WHERE id = v_variant;
        END IF;
      END LOOP;
    ELSE
      FOR r IN
        SELECT variant_id, COALESCE(location,'main') AS loc, SUM(quantity)::int AS qty
        FROM public.order_items
        WHERE order_id = OLD.id AND variant_id IS NOT NULL
        GROUP BY variant_id, COALESCE(location,'main')
      LOOP
        IF r.loc = 'incubator' THEN
          UPDATE public.product_variants SET stock_incubator = stock_incubator + r.qty WHERE id = r.variant_id;
        ELSE
          UPDATE public.product_variants SET stock_main = stock_main + r.qty WHERE id = r.variant_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_restore_stock_on_delete ON public.orders;
CREATE TRIGGER trg_orders_restore_stock_on_delete
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_restore_stock_on_delete();
