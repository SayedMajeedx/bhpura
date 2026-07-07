## Goal

Extend the existing RBAC/Team Management foundation to add a `super_admin` tier (locked to `majeed@hotmail.it`), prepare for future multi-brand tenancy via `brand_id`, and harden the Team page + guards. The existing Team UI, edge function, and profile context are kept and extended (not rewritten).

## 1. Database migration

Single migration that:

- Drops the current `role` CHECK constraint and adds a new one: `role IN ('super_admin','admin','staff')`.
- Adds `brand_id uuid NULL` to `profiles` + index (nullable, no FK yet — future `brands` table will add it).
- Adds `brand_id uuid NULL` to the main tenant-scoped tables (`products`, `product_variants`, `orders`, `customers`, `expenses`, `business_settings`, `activity_logs`, `campaigns/message_templates`) so future isolation is a filter change, not a re-migration. All nullable, no policy change today.
- Updates helper fns:
  - `is_admin()` → true for `admin` OR `super_admin` (active).
  - New `is_super_admin()` → true only for `super_admin` (active).
- Updates `handle_new_user()`: if `NEW.email = 'majeed@hotmail.it'` → role `super_admin`, status `active`. Otherwise keep existing first-user-becomes-admin logic.
- Seed/upsert: if a profile row exists for `majeed@hotmail.it`, force `role='super_admin'`, `status='active'`. If the auth user exists but no profile, insert one.
- RLS additions on `profiles`:
  - Only `super_admin` can UPDATE another profile's `role` to/from `super_admin` (enforced via trigger since RLS can't diff columns cleanly).
  - `super_admin` cannot be deleted or deactivated by non-super_admin (trigger-enforced).

## 2. Edge function `user-management`

- Extend role validation to accept `super_admin` only when caller is `super_admin`.
- `create`: staff/admin allowed for admins; only super_admin can create another super_admin (in practice unused — majeed is fixed).
- `update`: block non-super_admin from changing a super_admin's role/status; block downgrading the fixed super_admin email.
- `delete`: block deleting `majeed@hotmail.it` or any super_admin unless caller is super_admin (and not self).
- `list`: unchanged, returns everyone; UI badges super_admin distinctly.
- Defensive: wrap role/brand_id reads with `?? null` so missing columns don't 500.

## 3. Profile context (`src/lib/profile-context.tsx`)

- Extend `UserRole` union: `'super_admin' | 'admin' | 'staff'`.
- Add `brandId: string | null` to `Profile`.
- Add derived flags: `isSuperAdmin`, keep `isAdmin` true for both admin + super_admin, `canViewFinancials` stays admin+.
- Fallback profile logic unchanged; if fetched email === `majeed@hotmail.it`, force `isSuperAdmin = true` client-side as a defensive default.

## 4. Team Management page (`src/routes/_authenticated/team.tsx`)

Additive changes only:

- Route `beforeLoad`: allow `admin` OR `super_admin`.
- Add "Super Admin" badge row (crown icon) — non-editable, non-deletable in the UI for anyone except a super_admin viewer.
- Role select in Add/Edit dialogs: show `Super Admin` option only when current viewer `isSuperAdmin`.
- Actions menu: hide Edit/Delete/Suspend on super_admin rows unless viewer is super_admin; never allow deleting/suspending self.
- Full bilingual pass on any new strings; RTL flips already handled by root `dir` attribute.
- Loading skeleton + try/catch already in place; add graceful "column missing" fallbacks (treat as null).

## 5. Route + dashboard guards

- `app-shell.tsx`: Team Management nav item visible for both `admin` and `super_admin` (already gated on `isAdmin` which will now cover both).
- Dashboard financial widgets already use `canViewFinancials` — verify staff sees hidden state (no change needed if flag correct).
- Force logout on inactive: existing `profile-context` effect + `_authenticated/route.tsx` gate already do this; add a bilingual toast right before signOut so the user sees the reason.

## 6. Multi-tenancy readiness (no behavior change today)

- `brand_id` columns added but not enforced in RLS.
- Document (comment in migration) that future brand isolation = add `brands` table + tighten policies to `brand_id = current_user_brand()`; today all rows have `brand_id IS NULL` = shared/default brand.

## Technical notes

- Migration must include GRANTs re-issued only if new tables were created (none here — only ALTERs), so no GRANT block needed.
- The fixed super_admin email `majeed@hotmail.it` is enforced in 3 layers: DB trigger on signup, seed upsert, edge function guard.
- No changes to barcode, orders, inventory, or any other module.

## Files touched

- `supabase/migrations/<new>.sql` (new)
- `supabase/functions/user-management/index.ts`
- `src/lib/profile-context.tsx`
- `src/routes/_authenticated/team.tsx`
- (verify only) `src/components/app-shell.tsx`, `src/routes/_authenticated/dashboard.tsx`
