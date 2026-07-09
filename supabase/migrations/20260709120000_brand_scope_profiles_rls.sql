-- ============================================================================
-- Fix: `profiles` RLS was never brand-scoped like every other tenant table.
--
-- Previously:
--   "Admins can read all profiles"   USING (is_admin())
--   "Admins can insert profiles"     WITH CHECK (is_admin())
--   "Admins can update profiles"     USING (is_admin()) WITH CHECK (is_admin())
--   "Admins can delete profiles"     USING (is_admin())
--
-- is_admin() only checks `role IN ('admin','super_admin')` — it does not
-- check brand_id. That means any user with the legacy 'admin' role could
-- read/insert/update/delete profile rows belonging to EVERY brand on the
-- platform via direct PostgREST access, not just their own, even though the
-- user-management edge function correctly scoped things in application code.
--
-- This migration brings profiles.* in line with the "brand access" pattern
-- already used for products/orders/customers/etc: super_admin is unrestricted,
-- everyone else is confined to their own brand_id (or their own row).
-- ============================================================================

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.is_admin() AND brand_id IS NOT DISTINCT FROM public.current_brand_id())
  );

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_admin() AND brand_id IS NOT DISTINCT FROM public.current_brand_id())
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.is_admin() AND brand_id IS NOT DISTINCT FROM public.current_brand_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_admin() AND brand_id IS NOT DISTINCT FROM public.current_brand_id())
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.is_admin() AND brand_id IS NOT DISTINCT FROM public.current_brand_id())
  );

-- "Users can update own profile" (id = auth.uid()) is untouched — a user
-- editing their own row is always fine regardless of brand.

-- Belt-and-suspenders: no one but a super admin may ever touch a
-- super_admin row. This MUST be a RESTRICTIVE policy — permissive policies
-- in Postgres combine with OR, so adding this as another permissive policy
-- would have *widened* access instead of narrowing it. Restrictive policies
-- combine with AND across all matching policies for the command.
DROP POLICY IF EXISTS "Protect super admin row" ON public.profiles;
CREATE POLICY "Protect super admin row"
  ON public.profiles AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (role <> 'super_admin' OR public.is_super_admin())
  WITH CHECK (role <> 'super_admin' OR public.is_super_admin());

DROP POLICY IF EXISTS "Protect super admin row from delete" ON public.profiles;
CREATE POLICY "Protect super admin row from delete"
  ON public.profiles AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (role <> 'super_admin' OR public.is_super_admin());
