-- Fix business_settings primary key: it should be per brand, not per user.
-- Super admin owns multiple brands, so user_id PK causes duplicate key on 2nd brand.

ALTER TABLE public.business_settings DROP CONSTRAINT IF EXISTS business_settings_pkey;
ALTER TABLE public.business_settings ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE public.business_settings ADD CONSTRAINT business_settings_pkey PRIMARY KEY (brand_id);
-- Ensure one settings row per (user, brand) to prevent accidental dupes
CREATE UNIQUE INDEX IF NOT EXISTS business_settings_user_brand_key ON public.business_settings(user_id, brand_id);
