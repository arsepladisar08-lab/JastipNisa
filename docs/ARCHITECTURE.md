# JastipNisa — Architecture

## Selected stack

- **Frontend:** React + Vite + TypeScript.
- **Routing:** React Router.
- **Backend/data/auth/storage:** Supabase Auth, PostgreSQL, Row Level Security and Supabase Storage.
- **Hosting:** Vercel static frontend deployment.
- **Tests:** Vitest for domain logic; browser automation can be added with Playwright.

The source repository is greenfield/empty. React + Vite + Supabase + Vercel is selected as a low-complexity stack aligned with the linked WebApp-Master-Skill integration profile. Supabase database/RLS is the trusted data boundary; the Vite client is not treated as a privileged backend.

## Route boundaries

- Public: `/`, `/katalog`, `/cara-kerja`, `/kebijakan`.
- Private UI: `/admin/login`, `/admin/*`.
- Admin route absence from public navigation and robots directives reduces discovery but does not secure data.
- Protected UI verifies Supabase session and role for navigation; PostgreSQL RLS independently enforces data access.

## Data model

- `profiles`: auth user profile and role (`customer` by default; initial admin is promoted manually).
- `catalog_products`: product model reference sourced from the official Flicka catalog.
- `catalog_variants`: official color/variant reference, separate from owned units.
- `units`: physical units acquired by JastipNisa, with actual photos, condition notes and inventory status.
- `buyers`: private customer identity/contact/address.
- `requests`: customer requested models/variants and admin matching status.
- `orders` + `order_items`: confirmed transaction and product lines.
- `payments`: payment ledger including deposit/payment evidence metadata.
- `shipments`: courier, tracking and fulfillment data.
- `expenses`: operational expense ledger.

## Access model

- Anonymous users may read only active public catalog products/variants.
- Anonymous users cannot read buyers, requests, orders, items, units, payments, shipments, expenses or profiles.
- Admin role is represented in `profiles.role` and cannot be set by a normal client.
- RLS policies call a narrowly scoped `is_admin()` helper. The helper is security-definer with a fixed search path and only returns a boolean.
- Admin promotion is a manual trusted SQL operation after the intended admin account is created in Supabase Auth.
- Service-role keys are never placed in `VITE_*` variables or browser bundles.

## Product data policy

The current official source is https://www.flickabags.com/products. Seed data is a point-in-time reference snapshot. Catalog records store `source_url` and `source_checked_at`. Listing a model does not assert JastipNisa has stock. Actual inventory is recorded independently in `units`.

## Payment and order boundaries

No payment gateway is enabled in this initial slice. The public journey instructs the customer to contact admin for deposit/payment details. Deposit amount, refund/carry-forward for unavailable requests, settlement deadline and complaint policy are open business decisions; never assume them in code. Shopee checkout is coordinated manually by admin and the buyer's Shopee username is recorded on the order in a later workflow slice.

## Deployment/environment

Browser-safe variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the publishable key provisioned by Supabase)

Optional:
- `VITE_ADMIN_WHATSAPP` (international digits only, without plus sign)
- `VITE_OFFICIAL_CATALOG_URL`

Never expose:
- Supabase service-role/secret key
- payment credentials
- private storage credentials

## Known limitations in the initial slice

No automatic catalog sync, payment integration, customer login, private photo upload, shipping API, or complete order/payment/stock CRUD until the corresponding vertical slices and end-to-end tests are implemented.
