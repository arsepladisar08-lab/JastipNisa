# Google Apps Script Reference — Audit & Migration Map

## Sources reviewed

- `PROJECT_JASTIPNISA.md` — Project Brief & Rencana MVP, v0.2 draft, 10 November 2026.
- `Index JastipNisa1.html` — responsive Google Apps Script HTML frontend.
- `Code JastipNisa1.gs` — Google Apps Script backend; Google Sheets is its data store.

These sources are treated as product and workflow references. They are not copied as a parallel production implementation.

## Architecture decision

**React + Vite + TypeScript + Supabase remains the single application architecture.** The HTML file depends on `google.script.run` and Apps Script template variables; the backend depends on Apps Script services and a bound Google Spreadsheet. Neither is directly executable in the existing Vite/Vercel application.

The Supabase repository already has a stronger relational foundation for the operational workflow: separate `requests`, `orders`, `order_items`, `units`, `payments`, `shipments` and `expenses`, with admin authorization and PostgreSQL transactions for order creation and payment ledger entries.

## Feature parity map

| GAS HTML / Code.gs feature | Existing React + Supabase foundation | Migration decision |
|---|---|---|
| Landing page, event hero and public catalog | Public storefront and official catalog reference pages | Keep current React pages; event details should become configurable rather than hard-coded |
| Fee calculator and fee table | Shared TypeScript fee function and PostgreSQL fee calculation | Keep the current rule as the single business rule: 1 item Rp15.000; 2 items Rp25.000; each item after the second adds Rp10.000 |
| Customer cart and order creation | Admin request intake, then admin-only final order creation | Do not copy GAS's direct public `createOrder` as a confirmed order; keep request and final order as separate states |
| Order code + last four digits of phone lookup | No public customer status portal yet | Build a customer access token with high entropy; do not use four phone digits as the access secret |
| Customer format-order submission | Final order requires admin-entered customer details | Add a customer-facing, token-authorized format form after actual units are found and confirmed |
| Shopee username confirmation | Admin field and database fulfillment guard | Preserve confirmation requirement; expose a token-authorized customer confirmation step in a later slice |
| Admin catalog | Admin catalog manager and Supabase catalog tables | Keep; add variant management and import/export later |
| Physical unit + condition/photo | Admin unit manager and private Storage | Keep; tie unit assignment to order item and derive status through order workflow |
| Payment ledger, refund and expenses | Admin payment RPC and expenses table | Keep transactional ledger; reports need separate realized revenue, balance, inventory capital and costs |
| Daftar buru / search list | Request list and item-level order editor | Build a grouped demand queue by model/variant and event; not present as a complete standalone queue yet |
| Settings / event timing / bank / WhatsApp | WhatsApp number environment variable; no complete settings/event module | Keep secrets private; add an admin-managed event/settings model instead of returning the complete GAS Settings sheet publicly |

## Business rules to preserve

- No purchase limit per customer.
- Fee is calculated per order by the number of physical products, not per person.
- Products cannot be returned to the store.
- Official catalog prices and models are reference information, not verified JastipNisa stock.
- Actual unit photos and condition should be sent before final customer confirmation.
- Packing/shipping processing estimate remains 2–3 business days, not a courier delivery guarantee.
- Shopee is an optional path; customer account confirmation is required before fulfillment.

Deposit amount, refund/carry-forward treatment for unavailable goods, customer cancellation after photo approval, final complaint handling, shipping carrier/price and settlement deadline remain open business decisions in the brief. They must not be invented as implementation defaults.

## Security and correctness lessons from the GAS prototype

1. The backend contains a placeholder admin password string. Do not port the password/hash/session design; Supabase Auth + role-based RLS is the target.
2. Customer status lookup uses a short order code plus the last four phone digits. That is not an adequate standalone secret and the CacheService attempt counter is not a durable abuse-control boundary.
3. Some HTML dynamic values are interpolated into `innerHTML` and inline handlers without consistent escaping. Rebuild with React text rendering and validated data; do not port raw HTML-string rendering.
4. Public `pub()` returns the Settings sheet together with catalog data. Public APIs must return an explicit allow-list and never expose bank details, admin-only settings or private operational data.
5. Spreadsheet row numbers are used as update identifiers. Supabase UUIDs and database constraints are the stable record identity.
6. Server-side validation is mandatory. Browser form checks do not protect Apps Script functions or database RPCs.

## Implementation slices

1. **Workflow integrity:** protect unit reservations, make fulfillment-derived stock state read-only in the UI, and make shipment/status writes atomic. This is the current branch.
2. **Customer request intake:** public multi-item wishlist/deposit submission, with explicit rules for what customers may submit; retain admin verification before a final order exists.
3. **Customer status and approval:** high-entropy access token, private status projection, actual-unit photo review, final address/order format and Shopee username confirmation.
4. **Operations:** grouped daftar buru, event configuration, searchable inventory, cancellations and stock reassignment audit.
5. **Finance and release:** realized cash/revenue, outstanding balances, inventory capital, refunds and expense reports; live RLS/storage tests and deployment gate.

## Release boundary

This branch does not create a live customer portal, does not apply migrations to a Supabase project and does not deploy to Vercel. It strengthens the database/application foundation for those next features. A real Supabase project, administrator account and production environment still need explicit configuration and verification.
