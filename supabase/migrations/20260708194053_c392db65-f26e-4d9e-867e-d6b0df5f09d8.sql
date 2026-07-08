DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  AND brand_id IS NOT DISTINCT FROM (SELECT brand_id FROM public.profiles WHERE id = auth.uid())
);