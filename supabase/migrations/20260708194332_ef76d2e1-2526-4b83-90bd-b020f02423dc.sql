ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS description_en text;

UPDATE public.products
  SET name_en = COALESCE(name_en, name)
  WHERE name_en IS NULL AND name IS NOT NULL;

UPDATE public.products
  SET description_en = COALESCE(description_en, description)
  WHERE description_en IS NULL AND description IS NOT NULL;

-- Ensure anon can still read these fields on the public storefront (variant read policy relies on products readable via existing 'products public read')
GRANT SELECT (name_ar, name_en, description_ar, description_en) ON public.products TO anon;