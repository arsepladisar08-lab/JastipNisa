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
- [x] Add initial Supabase schema and RLS baseline.
- [ ] Configure Supabase project/environment and promote first admin.
- [ ] Install dependencies and run build/typecheck in a real environment.

### Slice 1 — Public storefront
- [x] Public landing page and catalog reference list.
- [x] Ordering flow, fee rule, policies and WhatsApp CTA.
- [ ] Confirm content/policies and admin WhatsApp number.

### Slice 2 — Admin workspace foundation
- [x] Private login route and role gate.
- [x] Admin dashboard/catalog/request/order views foundation.
- [ ] Complete CRUD for every operational entity.
- [ ] Upload actual unit photos/payment proof to private storage.

### Slice 3 — Operational workflow
- [ ] Request matching to actual units.
- [ ] Buyer/order details and item-level fee calculation.
- [ ] Payment ledger and deposit/refund/carry-forward controls after business decisions.
- [ ] Shopee link and username confirmation.
- [ ] Shipment, tracking and expense management.

### Slice 4 — Verification and release
- [ ] Apply migrations in a disposable Supabase project.
- [ ] Verify anonymous/admin RLS matrix and role escalation denial.
- [ ] Run unit, typecheck, lint, production build and browser journeys.
- [ ] Configure Vercel environment variables and preview deployment.
- [ ] Run independent evaluator pass; do not promote production before P0 acceptance.

## Verification record

The repository was empty before initialization. GitHub file creation confirms commits were accepted; it does not prove that the application builds or that Supabase policies have been applied. Runtime checks remain unrun until the project is installed and connected to a Supabase environment.
