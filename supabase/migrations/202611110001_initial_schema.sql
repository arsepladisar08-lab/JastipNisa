-- JastipNisa initial schema.
-- Apply using Supabase CLI or SQL Editor in a development project first.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text,
  official_price numeric(12,2),
  currency text not null default 'IDR',
  official_product_url text not null,
  image_url text,
  source_url text not null default 'https://www.flickabags.com/products',
  source_checked_at date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_products_price_nonnegative check (official_price is null or official_price >= 0)
);

create table if not exists public.catalog_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null unique,
  product_id uuid references public.catalog_products(id) on delete set null,
  variant_id uuid references public.catalog_variants(id) on delete set null,
  purchased_at date,
  purchase_price numeric(12,2),
  selling_price numeric(12,2),
  actual_photo_urls text[] not null default '{}',
  condition_notes text,
  receipt_reference text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'packed', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_purchase_price_nonnegative check (purchase_price is null or purchase_price >= 0),
  constraint units_selling_price_nonnegative check (selling_price is null or selling_price >= 0)
);

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete set null,
  customer_name text,
  customer_phone text,
  product_id uuid references public.catalog_products(id) on delete set null,
  requested_product_name text not null,
  requested_variant text,
  notes text,
  status text not null default 'new' check (status in ('new', 'deposit_received', 'searching', 'found', 'not_found', 'converted', 'cancelled')),
  actual_photo_urls text[] not null default '{}',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  buyer_id uuid references public.buyers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  shipping_address text not null,
  checkout_method text not null default 'manual' check (checkout_method in ('manual', 'shopee')),
  shopee_checkout_url text,
  shopee_username text,
  product_subtotal numeric(12,2) not null default 0,
  product_count integer not null default 0,
  jastip_fee numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'deposit_received', 'admin_searching', 'awaiting_customer_details', 'confirmed', 'packing', 'shipped', 'completed', 'cancelled', 'issue')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_received', 'partially_paid', 'paid', 'refunded')),
  customer_shopee_confirmed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_nonnegative check (
    product_subtotal >= 0 and product_count >= 0 and jastip_fee >= 0
    and shipping_fee >= 0 and discount >= 0 and total_amount >= 0
  )
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  product_id uuid references public.catalog_products(id) on delete set null,
  product_name_snapshot text not null,
  variant_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_type text not null default 'deposit' check (payment_type in ('deposit', 'settlement', 'shipping', 'refund')),
  method text not null default 'bank_transfer',
  proof_url text,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier text,
  tracking_number text,
  status text not null default 'preparing' check (status in ('preparing', 'shipped', 'delivered', 'issue')),
  processed_at timestamptz,
  shipped_at timestamptz,
  estimated_processing_days text not null default '2–3 hari kerja',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_products_active_sort on public.catalog_products (is_active, sort_order);
create index if not exists idx_catalog_variants_product on public.catalog_variants (product_id, is_active);
create index if not exists idx_units_status on public.units (status);
create index if not exists idx_requests_status_created on public.requests (status, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_shipments_order on public.shipments (order_id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array['profiles','catalog_products','catalog_variants','units','buyers','requests','orders','shipments'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', tbl, tbl);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_variants enable row level security;
alter table public.units enable row level security;
alter table public.buyers enable row level security;
alter table public.requests enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.expenses enable row level security;

-- Public users can see only active, official catalog reference data.
drop policy if exists "Public can read active catalog products" on public.catalog_products;
create policy "Public can read active catalog products"
  on public.catalog_products for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read active catalog variants" on public.catalog_variants;
create policy "Public can read active catalog variants"
  on public.catalog_variants for select to anon, authenticated
  using (is_active = true and exists (
    select 1 from public.catalog_products p
    where p.id = product_id and p.is_active = true
  ));

-- Users can read only their own profile. Admin can read and manage profiles.
drop policy if exists "Users read own profile or admin reads all" on public.profiles;
create policy "Users read own profile or admin reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Admin manages profiles" on public.profiles;
create policy "Admin manages profiles"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- All operational data is admin-only.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['units','buyers','requests','orders','order_items','payments','shipments','expenses'] loop
    execute format('drop policy if exists "Admin full access" on public.%I', tbl);
    execute format('create policy "Admin full access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', tbl);
  end loop;
end;
$$;

-- Catalog mutations are admin-only; active SELECT policy remains public.
drop policy if exists "Admin inserts catalog products" on public.catalog_products;
create policy "Admin inserts catalog products"
  on public.catalog_products for insert to authenticated with check (public.is_admin());
drop policy if exists "Admin updates catalog products" on public.catalog_products;
create policy "Admin updates catalog products"
  on public.catalog_products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin deletes catalog products" on public.catalog_products;
create policy "Admin deletes catalog products"
  on public.catalog_products for delete to authenticated using (public.is_admin());

drop policy if exists "Admin manages catalog variants" on public.catalog_variants;
create policy "Admin manages catalog variants"
  on public.catalog_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.catalog_products, public.catalog_variants to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.units, public.buyers, public.requests, public.orders, public.order_items, public.payments, public.shipments, public.expenses to authenticated;
grant select, insert, update, delete on public.catalog_products, public.catalog_variants to authenticated;

-- Bootstrap the first admin only after creating that user in Supabase Auth:
-- update public.profiles set role = 'admin', is_active = true
-- where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
