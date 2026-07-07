
-- =========================================================================
-- 1. PROFILES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'staff',
  status text NOT NULL DEFAULT 'active',
  brand_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure role/status check constraints reflect the new role set
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'staff'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'inactive'));

-- brand_id may already exist from a prior partial run
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_id uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_role     ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status   ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_brand_id ON public.profiles(brand_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. HELPER FUNCTIONS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin','super_admin')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  );
$$;

-- =========================================================================
-- 3. RLS POLICIES
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================================
-- 4. updated_at TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================================
-- 5. AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count integer;
  user_role text;
BEGIN
  IF lower(NEW.email) = 'majeed@hotmail.it' THEN
    user_role := 'super_admin';
  ELSE
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    IF user_count = 0 THEN
      user_role := 'admin';
    ELSE
      user_role := 'staff';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    user_role,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 6. BACKFILL PROFILES FOR EXISTING AUTH USERS
-- =========================================================================
INSERT INTO public.profiles (id, email, name, role, status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  CASE WHEN lower(u.email) = 'majeed@hotmail.it' THEN 'super_admin' ELSE 'admin' END,
  'active'
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Force the fixed super admin
UPDATE public.profiles
SET role = 'super_admin', status = 'active'
WHERE lower(email) = 'majeed@hotmail.it';

-- =========================================================================
-- 7. PROTECT SUPER ADMIN
-- =========================================================================
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_is_super boolean;
BEGIN
  SELECT public.is_super_admin() INTO caller_is_super;

  IF TG_OP = 'DELETE' THEN
    IF lower(OLD.email) = 'majeed@hotmail.it' THEN
      RAISE EXCEPTION 'The primary super admin cannot be deleted';
    END IF;
    IF OLD.role = 'super_admin' AND NOT caller_is_super THEN
      RAISE EXCEPTION 'Only a super admin can delete a super admin';
    END IF;
    RETURN OLD;
  END IF;

  IF lower(OLD.email) = 'majeed@hotmail.it' THEN
    IF NEW.role <> 'super_admin' OR NEW.status <> 'active' THEN
      RAISE EXCEPTION 'The primary super admin role and active status cannot be changed';
    END IF;
  END IF;

  IF (OLD.role = 'super_admin' OR NEW.role = 'super_admin')
     AND OLD.role IS DISTINCT FROM NEW.role
     AND NOT caller_is_super THEN
    RAISE EXCEPTION 'Only a super admin can grant or revoke the super admin role';
  END IF;

  IF OLD.role = 'super_admin' AND OLD.status = 'active' AND NEW.status <> 'active' AND NOT caller_is_super THEN
    RAISE EXCEPTION 'Only a super admin can deactivate a super admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_super_admin ON public.profiles;
CREATE TRIGGER profiles_protect_super_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- =========================================================================
-- 8. MULTI-BRAND READINESS: nullable brand_id on tenant-scoped tables
-- =========================================================================
ALTER TABLE public.products             ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.product_variants     ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.orders               ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.customers            ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.expenses             ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.business_settings    ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.activity_logs        ADD COLUMN IF NOT EXISTS brand_id uuid;
ALTER TABLE public.message_templates    ADD COLUMN IF NOT EXISTS brand_id uuid;

CREATE INDEX IF NOT EXISTS idx_products_brand_id  ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id    ON public.orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_customers_brand_id ON public.customers(brand_id);

-- Note: brand_id is nullable and not enforced by RLS today. Future
-- multi-brand isolation will add a brands table and tighten policies to
-- filter by the current user's brand_id.
