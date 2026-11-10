# Supabase Setup — JastipNisa

## 1. Create project

Create a Supabase project for JastipNisa. Use a development project first. Keep database backups and restrict dashboard access to trusted maintainers.

## 2. Configure application environment

Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL`: Project URL.
- `VITE_SUPABASE_ANON_KEY`: anon/publishable browser key.
- `VITE_ADMIN_WHATSAPP`: admin WhatsApp phone in international digits without a plus sign.

Only public/publishable credentials belong in `VITE_*` variables. Never add the service-role key to Vite environment variables.

## 3. Apply schema

In the Supabase SQL Editor, run `supabase/migrations/202611110001_initial_schema.sql`.

Review the migration before applying it to any existing production database. This repository started empty, but schema changes are still consequential.

## 4. Seed official catalog references

Run `supabase/seed.sql`. The 12 product rows are a point-in-time reference snapshot from the official product listing. It does not create physical stock records and does not guarantee price/variant availability. Recheck source prices and product pages before quoting a customer.

## 5. Create and promote the first admin

1. Open Authentication → Users in the Supabase dashboard.
2. Create the intended admin account and complete any configured email confirmation.
3. Open SQL Editor and run the following with the exact email used above:

```sql
update public.profiles
set role = 'admin', is_active = true, updated_at = now()
where id = (
  select id from auth.users
  where email = 'YOUR_ADMIN_EMAIL'
);
```

4. Verify exactly one intended account is promoted.
5. Sign in at `/admin/login`.

All newly registered Auth users receive the `customer` role. A normal user cannot self-promote because profile mutations are restricted by RLS.

## 6. Verify RLS before public release

- Anonymous visitor: can select active catalog products and variants only.
- Anonymous visitor: cannot read or write customer, request, unit, order, payment, shipment, expense or profile data.
- Authenticated customer: can read their own profile only and has no operational table access.
- Admin: can access operational tables after the profile role is promoted.
- Customer cannot change their role to admin through the client.

Use a disposable project and Supabase SQL/editor/API testing to validate both allowed and denied operations. Never paste private customer data into test fixtures.

## 7. Storage

Actual unit photos and payment evidence should use private Storage buckets with admin-only policies before upload UI is implemented. Do not use public buckets for addresses, payment proofs or private order documents.
