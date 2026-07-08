## 1. Manage Brands — Edit & Delete

`/brands` (Super Admin) will get per-card **Edit** and **Delete** actions.

- **Edit dialog** (reuses `NewBrandDialog` shape): name_en, name_ar, logo URL + upload button, primary color picker, about_en/about_ar textareas, is_active toggle. Slug is shown read-only (changing a slug would break URLs, invoices, storefront links).
- **Delete dialog** with a red confirmation warning listing what will be affected (products, orders, customers, storefront). To keep data safe by default we use a **soft-delete**: sets `is_active = false` and appends a `-deleted-<timestamp>` suffix to the slug so the name can be reused. A checkbox "Permanently delete (destructive)" is only offered when the brand has zero orders/products; the backend enforces this via a new `delete_brand(brand_id, hard)` SECURITY DEFINER RPC restricted to super admin.

## 2. Bahraini Shipping Address Structure

Add a **Block** field everywhere and standardise the six fields:
Label / Region / Block / Road / House / Flat.

**Schema (migration):**
- `ALTER TABLE customers ADD COLUMN block text;`
- `ALTER TABLE customer_addresses ADD COLUMN block text;`
- Update `place_storefront_order` RPC to accept and persist `block` on the customer row *and* to insert a matching `customer_addresses` row (label defaults to "Home") linked to the new order via `orders.shipping_address_id`.

**Admin portal (orders detail):** the customer form and saved-address picker gain a Block field; `formatDeliveryAddress` in `bahrain-regions.ts` is extended to include it and to render each part with a labelled prefix (`Block: 123, Road: 456, House: 12, Flat: 4`) — both Arabic and English.

**Storefront checkout:** replace the current flat "Address / City" fields with the six-field group (Label, Region dropdown from `bahrain-regions`, Block, Road, House, Flat-optional). Region uses the existing dropdown from `src/lib/bahrain-regions.ts`.

**Invoice / order voucher:** `download-invoice-pdf.ts`, `thermal-print.ts`, order detail print view, and the public `/invoice/:id` route all render the address via a single helper that outputs the labelled string ("Block: X, Road: Y, House: Z, Flat: W, Region: …"), so admin, thermal receipt, PDF, and shopper's thank-you page all match.

## 3. Storefront Customer Auth + Fulfillment Method + Delivery Fee

**Storefront auth (`/store/$slug/auth`):**
- Email + password sign-up / sign-in using the standard Supabase client — same table the admin portal uses, so accounts unify.
- On successful sign-up a client-side call to a new `link_storefront_customer` RPC creates (or links) a `customers` row for that `brand_id` where `email` matches and stores the new `auth_user_id` column on that row.
- Checkout header shows "Sign in / Sign up" when logged out and the customer's name when logged in. Guest checkout stays supported; if a logged-in user checks out we skip the name/phone/email fields and pull them from the profile.
- New column `customers.auth_user_id uuid` (nullable, indexed). RLS: keep existing "brand access" for staff; add a policy `TO authenticated USING (auth_user_id = auth.uid())` so shoppers can read their own record across brands.

**Fulfillment method:**
- Add `orders.fulfillment_method text NOT NULL DEFAULT 'delivery'` (check `'delivery' | 'pickup'`).
- Storefront checkout: prominent two-tile selector (توصيل / استلام من الفرع) above the payment method.
- Order summary: adds a "Delivery fee" line when `delivery`; hides it (or shows "Pickup — free") when `pickup`.

**Delivery fee (per brand):**
- `business_settings.delivery_fee numeric(10,2) NOT NULL DEFAULT 0`.
- Brand admin `/b/$slug/settings` gets a new card **Shipping** with a delivery-fee numeric input, saved through the existing settings save action.
- `place_storefront_order` RPC now reads `delivery_fee` from `business_settings` and writes `shipping = delivery_fee` on the order when method = delivery, `shipping = 0` when pickup; totals are recomputed accordingly.
- Column-level anon `GRANT SELECT (delivery_fee, fulfillment_pickup_enabled)` and `brand_public_settings` view is updated so the storefront can display the fee before checkout.

## 4. Global UI Contrast Audit

Fix in `src/styles.css`:
- Bump `--muted-foreground` in light mode from `oklch(0.5 0.02 25)` → `oklch(0.42 0.02 25)` (AA on white).
- Bump `--muted-foreground` in dark mode from `oklch(0.72 0.02 70)` → `oklch(0.82 0.02 70)`.
- Force `input, textarea, select { color: var(--color-foreground); background-color: var(--color-background); }` and `::placeholder { color: var(--color-muted-foreground); opacity: 1; }` in `@layer base` so shadcn inputs never render foreground=background in any theme.
- Add `[data-slot="select-value"], [data-radix-select-value] { color: inherit; }` fallback to fix invisible dropdown text on the Radix Select trigger.
- Table cells: ensure `<th>`/`<td>` inherit `--color-foreground` (the shadcn `<table>` primitive is fine; the storefront's ad-hoc tables get a `text-foreground` utility on their `<tbody>`).
- Storefront: the `text_color` / `background_color` inline styles on the store shell will only apply to the shell wrapper; inputs and cards inside `<main>` will use design tokens (not the raw brand colors) so shopper input text stays readable regardless of the brand palette.

## 5. Developer Integrations Tab (placeholder)

- New route `src/routes/_authenticated/b.$slug.integrations.tsx` linked from the brand sidebar (label: "ربط المطورين / Developer integrations").
- New table `integration_credentials` (`id, brand_id, provider text, base_url text, api_key text, webhook_secret text, is_active bool, notes text`) — RLS gated to `is_admin() AND can_access_brand(brand_id)`; keys are stored as text for now with a UI warning that production wiring is pending. Values are masked in the list (`sk_live_••••1234`) and revealed with a "Show" toggle.
- UI: header + short explainer, a "New integration" dialog (provider dropdown seeded with Aramex, Posta Plus, Stripe, Tap, Custom, plus free-text), list of saved credentials with edit/delete, and a copy-to-clipboard for the brand's webhook target URL (`https://…/api/public/webhooks/<provider>/<brand_id>`). No actual outbound calls yet — this ships the schema + UI plumbing only.

## Technical notes

- Migration in a single file: adds `block` to customers + customer_addresses, `delivery_fee` to business_settings, `fulfillment_method` to orders, `auth_user_id` to customers, creates `integration_credentials`, updates `place_storefront_order` + `brand_public_settings` view, adds `delete_brand` and `link_storefront_customer` RPCs. Every new/altered public table gets the required GRANT block before RLS/policies.
- Files touched: `src/routes/_authenticated/brands.tsx` (edit/delete), `src/routes/_authenticated/b.$slug.settings.tsx` (shipping + delivery fee card), `src/routes/_authenticated/b.$slug.route.tsx` (sidebar link), new `b.$slug.integrations.tsx`, `src/routes/_authenticated/b.$slug.orders.$id.tsx` (Block field in address form, fulfillment method badge), `src/routes/store.$slug.checkout.tsx` (auth handoff, six-field address, fulfillment selector, delivery fee), new `src/routes/store.$slug.auth.tsx`, `src/lib/storefront-context.tsx` (session + delivery_fee in settings), `src/lib/bahrain-regions.ts` (labelled formatter with Block), `src/lib/download-invoice-pdf.ts` + `src/lib/thermal-print.ts` + `src/routes/invoice.$id.tsx` (labelled address rendering), `src/styles.css` (contrast fixes).

## Out of scope for this pass

- Real shipping-carrier API calls (Aramex/Posta Plus wiring beyond storing credentials).
- Real card processing (Stripe/Tap) — the UI stays as-is; only credential storage is added.
- Encryption-at-rest for API keys (would need Vault / server-side crypto; flagged in the Integrations UI).
