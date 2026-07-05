CREATE OR REPLACE FUNCTION public.sync_order_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_deducting boolean;
  r RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_deducting := v_order.status IN ('confirmed','paid','shipped','completed');

  IF v_deducting AND NOT v_order.stock_deducted THEN
    FOR r IN
      SELECT variant_id, SUM(quantity)::int AS qty
      FROM public.order_items
      WHERE order_id = p_order_id AND variant_id IS NOT NULL
      GROUP BY variant_id
    LOOP
      PERFORM 1 FROM public.product_variants WHERE id = r.variant_id AND stock >= r.qty FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', r.variant_id;
      END IF;
      UPDATE public.product_variants SET stock = stock - r.qty WHERE id = r.variant_id;
    END LOOP;
    UPDATE public.orders SET stock_deducted = true WHERE id = p_order_id;

  ELSIF NOT v_deducting AND v_order.stock_deducted THEN
    FOR r IN
      SELECT variant_id, SUM(quantity)::int AS qty
      FROM public.order_items
      WHERE order_id = p_order_id AND variant_id IS NOT NULL
      GROUP BY variant_id
    LOOP
      UPDATE public.product_variants SET stock = stock + r.qty WHERE id = r.variant_id;
    END LOOP;
    UPDATE public.orders SET stock_deducted = false WHERE id = p_order_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_order_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_order_stock(uuid) TO authenticated, service_role;