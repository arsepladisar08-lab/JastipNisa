# Implementation Plan & Skill Provenance

## Master skill used

Repository: https://github.com/arsepladisar08-lab/WebApp-Master-Skill  
Inspected branch: `SOWAN`  
Inspected commit: `95921ab98659470ed02c6aca7f70ea5c19cb2160`  
Version declared in its `SKILL.md`: `0.2.0`  
License declared in `SKILL.md`: MIT  
Inspection date: 2026-11-11

This project follows the skill's **New WebApp** workflow and selectively applies:
- `SKILL.md` operating contract and phased discovery/definition/design/implementation/verification.
- `workflows/new-webapp.md` for PRD, architecture, design, scaffold and critical path.
- `integrations/react-vite-supabase-vercel.md` for stack boundaries, environment safety, auth and RLS expectations.
- `backend/database-design.md`, `backend/authentication-authorization.md`, `backend/security.md`.
- `design/design-system.md`, `design/frontend-design.md`, `design/responsive-design.md`.
- `frontend/forms-validation.md`, `quality/release-gate.md`, `integrations/supabase-rls-test-matrix.md` and `agents/evaluator-protocol.md`.

No substantial skill source file is vendored into this repository. This is a project-specific implementation guided by those modules, not a claim that the skill was run by an external coding agent.

## Delivery slices

### Slice 0 — Foundation
- [x] Define PRD, design and architecture.
- [x] Select React + Vite + TypeScript + Supabase.
- [x] Initialize public-first routes and theme.
- [x] Add initial Supabase schema, admin-only RPCs and RLS baseline.
- [x] Install dependencies and verify TypeScript, unit tests and production build through GitHub Actions CI.
- [ ] Configure a real Supabase project, apply migration/seed and promote the first admin account.

### Slice 1 — Public storefront
- [x] Public landing page and official catalog reference list.
- [x] Ordering flow, fee rule, policies and model-specific WhatsApp request CTA.
- [ ] Confirm final public copy and configure the admin WhatsApp number.

### Slice 2 — Admin workspace and operations
- [x] Private login route and profile-role gate.
- [x] Admin dashboard, catalog management, physical unit registration, request tracker and order manager.
- [x] Record the customer deposit and transfer proof at request stage; admin can verify or reject the proof.
- [x] Convert a request only after it is marked found and its deposit is verified; the database transfers that deposit/proof into the order ledger exactly once.
- [x] Register actual unit code, model/variant, price, condition, photo URL and stock status.
- [x] Create confirmed orders through an admin-only PostgreSQL RPC; server recalculates fee and atomically stores items and an optional actual deposit.
- [x] Reserve a selected physical unit in the same order transaction and validate that it matches the selected catalog product.
- [x] Record deposit, settlement, shipping payment and refund ledger entries; database recalculates net payment status.
- [x] Record optional payment-proof URL references.
- [x] Record Shopee checkout URL and confirmed Shopee username.
- [x] Record courier, tracking number and shipment state.
- [x] Record operating expenses and review the recorded total.
- [ ] Add private Supabase Storage upload for actual unit photos and payment-proof documents.

### Slice 3 — Further workflow refinement
- [ ] Link request records directly to matched physical unit IDs; current order creation pre-fills the customer/model/variant and transfers verified deposit from a found request.
- [ ] Improve cancellation handling and unit-release/reassignment controls.
- [ ] Add filters, pagination and report exports for large operational datasets.
- [ ] Add a customer-facing order status page only after the admin workflow is stable.

### Slice 4 — Deployment and release verification
- [x] Run GitHub Actions typecheck, fee unit tests and production build successfully on the previous toolchain (Run #39); current Node 22 / Vite 8 upgrade is being re-verified.
- [ ] Apply migration and seed in a disposable Supabase project.
- [ ] Verify anonymous/customer/admin RLS matrix and role-escalation denial against a live Supabase project.
- [ ] Run browser journeys against configured Supabase.
- [ ] Configure Vercel environment variables and create a preview deployment.
- [ ] Run independent evaluator pass; do not promote production before P0 acceptance.

## Verification record

The repository was empty before initialization. GitHub Actions Runs #36 and #39 passed dependency installation, TypeScript typecheck, unit tests and production build on the initial toolchain. A later Node 22 / Vite 8 / React 19 / TypeScript 7 upgrade is under CI verification. GitHub CI does not apply the Supabase migration or validate live RLS. No live Supabase project, admin account, WhatsApp number or Vercel deployment has been configured from this workspace yet.
