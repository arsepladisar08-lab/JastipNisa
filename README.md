# JastipNisa

Public-first jastip storefront and private admin workspace.

## Project status

Initial foundation / Phase 0.1. Public landing page and catalog shell are being established first. The admin entry is intentionally omitted from public navigation, but access control must be enforced with Supabase Auth, trusted server checks, and PostgreSQL RLS—not obscurity.

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

Copy `.env.example` to `.env.local`, fill in Supabase project URL and publishable/anon key, then install dependencies and start Vite.

No privileged service-role key belongs in browser environment variables.

## Docs

- [PRD](docs/PRD.md)
- [Design](docs/DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION.md)
