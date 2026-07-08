
-- 1. Fix SUPA_security_definer_view: recreate brand_public_settings as security_invoker
DROP VIEW IF EXISTS public.brand_public_settings;
CREATE VIEW public.brand_public_settings
WITH (security_invoker = true) AS
SELECT bs.brand_id, bs.business_name, bs.logo_url, bs.currency,
       bs.primary_color, bs.text_color, bs.background_color,
       bs.font_family, bs.font_url,
       bs.cod_enabled, bs.card_enabled, bs.benefit_enabled, bs.benefit_qr_url,
       bs.footer_note, bs.delivery_fee, bs.pickup_enabled, bs.delivery_enabled,
       bs.logo_size, bs.logo_align,
       bs.header_bg, bs.header_fg, bs.footer_bg, bs.footer_fg,
       bs.heading_color, bs.link_color,
       bs.btn_primary_bg, bs.btn_primary_fg, bs.btn_secondary_bg, bs.btn_secondary_fg
FROM public.business_settings bs
JOIN public.brands b ON b.id = bs.brand_id
WHERE b.is_active = true;

GRANT SELECT ON public.brand_public_settings TO anon, authenticated;

-- 2. Fix business_settings_public_read: restrict anon to non-sensitive columns.
--    The RLS policy still limits rows to active brands; column privileges limit which
--    fields anon can read. email, phone, vat_number, address, user_id, next_invoice_number,
--    default_tax_rate and other operational fields are no longer readable by anonymous users.
REVOKE SELECT ON public.business_settings FROM anon;
GRANT SELECT (
  brand_id, business_name, logo_url, currency,
  primary_color, text_color, background_color,
  font_family, font_url, font_size,
  cod_enabled, card_enabled, benefit_enabled, benefit_qr_url,
  footer_note, delivery_fee, pickup_enabled, delivery_enabled,
  logo_size, logo_align, logo_x, logo_y, logo_width, logo_height,
  header_bg, header_fg, footer_bg, footer_fg,
  heading_color, link_color,
  btn_primary_bg, btn_primary_fg, btn_secondary_bg, btn_secondary_fg
) ON public.business_settings TO anon;

-- 3. Fix product_variants_public_cost_price: restrict anon to customer-facing columns
--    (cost_price and internal stock breakdowns are no longer readable by anon).
REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, brand_id, size, color, fabric,
  selling_price, stock_main, sku, barcode, created_at, updated_at
) ON public.product_variants TO anon;
