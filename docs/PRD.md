# JastipNisa — Product Requirements Document

**Version:** 0.1.0  
**Status:** Initial implementation  
**Product:** Public-first Jastip storefront with a private admin operations workspace.

## 1. Product summary

JastipNisa helps customers browse products from the official Flicka catalog, contact the admin to place a request, receive actual availability confirmation and photos, submit delivery details, and choose the agreed shipping path. The admin manages catalog references, customer requests, orders, payments, stock units, shipping, expenses and operational reporting.

The public landing page is the default entry point. Admin tools exist at a direct route but are not linked in public navigation. Hidden navigation is not an authorization mechanism.

## 2. Users and roles

- **Public visitor/customer:** browses the catalog and process/policy information; initiates an order conversation with the admin through WhatsApp.
- **Admin:** authenticates through Supabase Auth and manages catalog references, requests, orders, actual units, payment records, shipments and expenses.
- **Future roles:** additional jastipers, resellers and platform administrators are explicitly out of MVP scope.

## 3. Goals

1. Provide a polished, responsive public landing page at `/`.
2. Show Flicka products as references sourced from the official catalog, with clear notice that catalog presence is not proof of JastipNisa stock.
3. Explain the deposit/payment-first order flow, admin verification/photo step, delivery details and optional Shopee checkout path.
4. Give the admin a protected workspace for day-to-day operations.
5. Persist operational data in Supabase PostgreSQL, with uploaded evidence/photos in Supabase Storage when configured.
6. Enforce private-data access with server/database authorization and RLS.

## 4. Non-goals

- No direct payment gateway in this initial release.
- No customer account or customer self-service order portal.
- No automatic scraping/synchronization of Flicka catalog.
- No automatic Shopee checkout or order reconciliation.
- No multi-jastiper, reseller, escrow or rekber features.
- No claim of official partnership, endorsement or affiliation with Flicka.

## 5. Primary journeys

### Public browsing
1. Visitor opens `/`.
2. Visitor reads the service summary, ordering process, fee rule and no-return disclosure.
3. Visitor opens the catalog and sees product models linking to the official Flicka source.
4. Visitor starts a WhatsApp conversation with a prefilled product/request message.

### Customer order (operational flow)
1. Customer makes deposit/payment according to admin instructions.
2. Customer sends transfer proof and requested product(s) to admin.
3. Admin checks the store and sends actual product/unit photos if found.
4. Customer sends final details: name, address, phone number and confirmed order.
5. Admin packs and processes shipping within an estimated 2–3 business days.
6. Optional Shopee path: admin sends a Shopee link; customer checks out, then confirms the Shopee username to admin.

### Admin operations
1. Admin signs in at `/admin/login`.
2. The application confirms a valid Supabase session and admin role.
3. Admin views key counters and recent requests/orders.
4. Admin maintains catalog reference records and request/order statuses.
5. Admin records payments and shipping data in later vertical slices.

## 6. Confirmed business rules

### Jastip fee per order
- 1 product: Rp15.000.
- 2 products: Rp25.000.
- 3 or more: Rp25.000 + Rp10.000 for each product after the second.
- Formula: `fee(n) = 0 if n <= 0; 15,000 if n = 1; 25,000 + (n - 2) × 10,000 if n >= 2`.
- No per-customer purchase limit is imposed by JastipNisa.

### Product and availability
- The displayed product catalog references the official Flicka catalog: https://www.flickabags.com/products
- A catalog model or variant is not equivalent to actual JastipNisa physical inventory.
- Admin must verify availability and send actual photos before final customer order details.
- Actual units and catalog models are separate data entities.

### Payment, shipping and returns
- Deposit/payment is the initial step.
- Admin processes packing and shipping in 2–3 business days (estimate).
- Products cannot be returned to the store.
- The public policy must not imply a store return option.
- Shopee checkout is optional; admin provides the link and customer must confirm the Shopee username after checkout.

## 7. Open business decisions — do not hard-code assumptions

- Deposit amount or percentage and whether it differs by product/order.
- Treatment of deposit if requested goods cannot be found (refund, carry-forward, substitution or another agreed action).
- Top-up/settlement amount and due time after admin sends actual photos.
- Whether the customer may cancel after actual photos are sent.
- Final customer-facing return/complaint policy for wrong item, shipping damage or a discrepancy from the approved photo.
- Shipping provider, shipping cost calculation and origin address.
- Admin WhatsApp number, payment account details and Shopee seller/store destination.
- Whether shipping estimate starts at payment confirmation or after final order data is received.

## 8. Functional requirements

| ID | Priority | Requirement | Acceptance |
|---|---|---|---|
| PUB-01 | P0 | Public landing page at `/` | Loads without authentication and is the default route |
| PUB-02 | P0 | Official catalog reference | Each visible product has source URL and price is labelled reference-only |
| PUB-03 | P0 | Order process and policy | Deposit-first, admin photo check, 2–3 day processing, no store returns and Shopee username confirmation are clear |
| PUB-04 | P0 | WhatsApp CTA | Produces a prefilled message; no fake success state |
| ADM-01 | P0 | Hidden admin route | No public nav link; direct login route is available |
| ADM-02 | P0 | Admin authorization | Non-admin and anonymous actors cannot access admin data |
| ADM-03 | P1 | Dashboard summary | Shows counts from persisted records, with clear empty state |
| ADM-04 | P1 | Catalog management | Admin can create/update/activate reference products |
| ADM-05 | P1 | Requests and orders | Admin can review persisted requests/orders and update permitted workflow statuses |
| DATA-01 | P0 | Database policies | RLS denies private table access to anonymous/non-admin clients |
| DATA-02 | P0 | Secrets | No service-role key or privileged secret is shipped to browser code |
| UX-01 | P0 | Responsive and accessible | Keyboard, focus, labels, reduced motion and narrow viewport support |
| OPS-01 | P1 | Deployment readiness | Environment variables and migrations are documented |

## 9. Privacy and security

Customer name, WhatsApp number, address, payment proof and Shopee username are private operational data. They must not be exposed by public catalog endpoints, public pages, analytics events or logs. Admin actions must be authorized in the database, not only hidden in the UI.

## 10. Initial release boundary

This first implementation establishes the public storefront, fee calculator, admin authentication gate, admin workspace shell, catalog reference seed and Supabase schema/RLS foundation. Advanced payment, upload, inventory/order lifecycle and automated integrations are subsequent vertical slices and must be marked incomplete until implemented and verified.
