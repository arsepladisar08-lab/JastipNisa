# JastipNisa

Public-first jastip storefront and private admin workspace.

## Project status

Foundation and admin operations are implemented: public storefront/catalog, Supabase Auth role gate, request/deposit verification, physical-unit tracking, final order creation, payment ledger, shipment tracking and operating expenses. The public customer request/status portal and direct customer-to-request workflow are still pending. Do not treat the app as production-ready until a real Supabase project has the migrations applied and the RLS/storage access matrix has been tested.

## Planned stack

- React + Vite + TypeScript
- Supabase Auth, PostgreSQL and Storage
- Vercel hosting
- Vitest for unit tests; Playwright for browser journeys when configured

## Routes

- `/` public landing page
- `/katalog` public Flicka reference catalog
- `/cara-kerja` public ordering process
- `/kebijakan` public policies
- `/admin/login` private admin sign-in (not linked publicly)
- `/admin/*` protected admin workspace

## Business rules

- Public product display is based on the official Flicka catalog: https://www.flickabags.com/products
- Official catalog models/variants are references; they do not represent JastipNisa's verified physical stock.
- Admin must confirm availability and send actual unit photos before customer finalizes order details.
- Jastip fee per order: 1 product Rp15,000; 2 products Rp25,000; 3+ products Rp25,000 + Rp10,000 for each product beyond 2.
- No per-customer purchase limit is imposed by JastipNisa.
- Store return is unavailable; disclose product/event condition and handling policy before payment.
- After admin packing, shipping processing estimate is 2–3 business days.
- Shopee checkout is an optional path: admin provides checkout link and customer must confirm their Shopee username after checkout.
- Deposit/payment is an initial step. Deposit amount, shortfall/top-up, and unavailable-item refund/carry-forward policy remain configurable/open decisions and must not be invented in code.

## Local development

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and fill in Supabase project URL and anon/publishable key.
3. Run `npm install`.
4. Apply `supabase/migrations/202611110001_initial_schema.sql` in a development Supabase project.
5. Run `supabase/seed.sql` to load the 12 official catalog reference models.
6. Create the intended admin account in Supabase Auth, then promote its profile using the commented bootstrap SQL at the bottom of the migration.
7. Run `npm run dev`.

Before building: `npm run typecheck`, `npm test`, and `npm run build`.

Set `VITE_ADMIN_WHATSAPP` to the admin's WhatsApp number in international digits (for example 62... without plus sign).

No privileged service-role key belongs in browser environment variables.

## Docs

- [Supabase setup & first-admin guide](docs/SUPABASE_SETUP.md)

- [PRD](docs/PRD.md)
- [Design](docs/DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION.md)
