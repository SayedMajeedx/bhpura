# Security fixes applied (2026-07-09)

## 1. Removed the "no profile → admin" fail-open fallback
- `src/lib/profile-context.tsx`: `createFallbackProfile()` deleted. A user
  whose profile can't be found or created now gets `profile = null`, and
  every derived flag (`isAdmin`, `isSuperAdmin`, `isBrandAdmin`, `isActive`,
  `canViewFinancials`) is `false` in that case instead of defaulting to admin.
- `src/components/app-shell.tsx`: renders a "account pending setup" screen
  (with sign-out button) instead of the admin shell when no profile could be
  resolved, so this isn't just an invisible permissions gap.
- `supabase/functions/user-management/index.ts`: the `admin`-role check now
  returns `403 Forbidden` immediately if the caller's profile lookup errors
  or returns nothing, instead of defaulting `callerRole` to `"admin"`.

## 2. Brand-scoped the `profiles` table RLS policies
New migration: `supabase/migrations/20260709120000_brand_scope_profiles_rls.sql`

Previously `profiles` SELECT/INSERT/UPDATE/DELETE policies only checked
`is_admin()` (role is `admin` or `super_admin`), with no brand check — unlike
every other tenant table, which uses `can_access_brand(brand_id)`. That meant
a user with the legacy `admin` role could read/modify staff profiles
belonging to *any* brand on the platform via direct PostgREST access, even
though the edge function scoped things correctly in application code.

The new migration requires `is_super_admin()` OR (`is_admin()` AND the row's
`brand_id` matches the caller's own `brand_id`), and adds two `RESTRICTIVE`
policies so only a super admin can ever modify/delete a `super_admin` row.

## 3. `.gitignore` / `.env.example`
- `.env` (and `.env.*`) added to `.gitignore`. The current `.env` only holds
  the anon/publishable key (safe to expose by design), but nothing was
  stopping a service-role key from landing in that file later and getting
  committed.
- Added `.env.example` with placeholder names.

## Not changed (flagged for your awareness only)
- The hardcoded `majeed@hotmail.it` super-admin bypass in
  `profile-context.tsx` and the edge function. This isn't itself an
  auth-bypass hole — it's an intentional break-glass account — but baking a
  personal email into source is a smell. Left alone since removing it could
  lock out the platform owner without a replacement mechanism in place; happy
  to move it to a Supabase secret/config table if you want.

## To apply
1. Run the new migration against your Supabase project (see chat message for
   how, if you're moving off Lovable Cloud).
2. Redeploy the `user-management` edge function.
3. Rebuild/redeploy the frontend.
