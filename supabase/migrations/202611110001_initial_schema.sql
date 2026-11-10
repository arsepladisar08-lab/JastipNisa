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
revoke all on function public.handle_new_user() from public;
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
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  deposit_method text not null default 'bank_transfer',
  deposit_proof_url text,
  deposit_payment_status text not null default 'not_received' check (deposit_payment_status in ('not_received', 'awaiting_verification', 'verified', 'applied_to_order', 'refunded', 'rejected')),
  deposit_received_at timestamptz,
  actual_photo_urls text[] not null default '{}',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  source_request_id uuid references public.requests(id) on delete set null,
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
drop policy if exists "Admin reads all catalog products" on public.catalog_products;
create policy "Admin reads all catalog products"
  on public.catalog_products for select to authenticated
  using (public.is_admin());

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


-- Fee is computed again in PostgreSQL so clients cannot choose an arbitrary fee.
create or replace function public.calculate_jastip_fee(p_product_count integer)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_product_count, 0) <= 0 then 0::numeric
    when p_product_count = 1 then 15000::numeric
    else 25000::numeric + ((p_product_count - 2) * 10000)::numeric
  end;
$$;

revoke all on function public.calculate_jastip_fee(integer) from public;
grant execute on function public.calculate_jastip_fee(integer) to authenticated;

create sequence if not exists public.order_code_seq;

-- Atomically creates an admin-confirmed order, its item snapshots and an optional
-- deposit/payment ledger row. The deposit amount is explicitly entered by admin;
-- no percentage or fixed deposit policy is assumed by this function.
create or replace function public.create_order(p_payload jsonb)
returns table(order_id uuid, order_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_code text;
  v_customer_name text;
  v_customer_phone text;
  v_shipping_address text;
  v_checkout_method text;
  v_product_count integer := 0;
  v_product_subtotal numeric(12,2) := 0;
  v_jastip_fee numeric(12,2) := 0;
  v_shipping_fee numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_deposit numeric(12,2) := 0;
  v_source_request_id uuid;
  v_request_deposit numeric(12,2);
  v_request_proof_url text;
  v_request_method text;
  v_request_payment_status text;
  v_request_product_id uuid;
  v_request_workflow_status text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_item jsonb;
  v_unit_id uuid;
  v_unit_status text;
  v_unit_product_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_payload is null then
    raise exception 'Order payload is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'items') is distinct from 'array' then
    raise exception 'Order items must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'Order must contain at least one item' using errcode = '22023';
  end if;

  v_customer_name := nullif(trim(p_payload ->> 'customer_name'), '');
  v_customer_phone := nullif(trim(p_payload ->> 'customer_phone'), '');
  v_shipping_address := nullif(trim(p_payload ->> 'shipping_address'), '');
  v_checkout_method := coalesce(nullif(p_payload ->> 'checkout_method', ''), 'manual');

  if v_customer_name is null or v_customer_phone is null or v_shipping_address is null then
    raise exception 'Customer name, phone and shipping address are required' using errcode = '22023';
  end if;

  if v_checkout_method not in ('manual', 'shopee') then
    raise exception 'Unsupported checkout method' using errcode = '22023';
  end if;
  if v_checkout_method = 'shopee'
     and nullif(trim(p_payload ->> 'shopee_checkout_url'), '') is null then
    raise exception 'Shopee checkout link is required' using errcode = '22023';
  end if;

  v_shipping_fee := coalesce(nullif(p_payload ->> 'shipping_fee', '')::numeric, 0);
  v_discount := coalesce(nullif(p_payload ->> 'discount', '')::numeric, 0);
  v_deposit := coalesce(nullif(p_payload ->> 'deposit_amount', '')::numeric, 0);
  v_source_request_id := nullif(p_payload ->> 'source_request_id', '')::uuid;

  if v_source_request_id is not null then
    select deposit_amount, deposit_proof_url, deposit_method,
           deposit_payment_status, product_id, status
      into v_request_deposit, v_request_proof_url, v_request_method,
           v_request_payment_status, v_request_product_id, v_request_workflow_status
    from public.requests
    where id = v_source_request_id
    for update;

    if not found then
      raise exception 'Source request not found' using errcode = 'P0002';
    end if;
    if v_request_payment_status <> 'verified' or v_request_deposit <= 0 then
      raise exception 'Source request deposit must be verified before order conversion' using errcode = '22023';
    end if;
    if v_request_workflow_status <> 'found' then
      raise exception 'Source request must be marked found before order conversion' using errcode = '22023';
    end if;
    if v_request_product_id is not null and not exists (
      select 1
      from jsonb_array_elements(p_payload -> 'items') as items(value)
      where nullif(value ->> 'product_id', '')::uuid = v_request_product_id
    ) then
      raise exception 'Order items must include the product requested in the source request' using errcode = '22023';
    end if;
    if nullif(p_payload ->> 'deposit_amount', '') is not null
       and (p_payload ->> 'deposit_amount')::numeric <> v_request_deposit then
      raise exception 'Deposit amount must match the verified source request deposit' using errcode = '22023';
    end if;
    v_deposit := v_request_deposit;
  end if;

  if v_shipping_fee < 0 or v_discount < 0 or v_deposit < 0 then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items')
  loop
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::integer, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);
    if v_quantity < 1 or v_unit_price <= 0 then
      raise exception 'Item quantity must be positive and unit price must be greater than zero' using errcode = '22023';
    end if;
    if nullif(trim(v_item ->> 'product_name_snapshot'), '') is null then
      raise exception 'Each item must include a product name' using errcode = '22023';
    end if;
    if nullif(v_item ->> 'product_id', '') is null then
      raise exception 'Each item must reference a catalog product' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.catalog_products p
      where p.id = (v_item ->> 'product_id')::uuid
    ) then
      raise exception 'Catalog product does not exist' using errcode = '22023';
    end if;
    v_product_count := v_product_count + v_quantity;
    v_product_subtotal := v_product_subtotal + (v_quantity * v_unit_price);
  end loop;

  v_jastip_fee := public.calculate_jastip_fee(v_product_count);
  if v_discount > (v_product_subtotal + v_jastip_fee + v_shipping_fee) then
    raise exception 'Discount cannot exceed the order subtotal and fees' using errcode = '22023';
  end if;
  v_total := v_product_subtotal + v_jastip_fee + v_shipping_fee - v_discount;
  v_order_code := 'JN-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.order_code_seq')::text, 6, '0');

  insert into public.orders (
    order_code, source_request_id, customer_name, customer_phone, shipping_address,
    checkout_method, shopee_checkout_url, product_subtotal, product_count,
    jastip_fee, shipping_fee, discount, total_amount, status, payment_status, admin_notes
  ) values (
    v_order_code, v_source_request_id, v_customer_name, v_customer_phone, v_shipping_address,
    v_checkout_method, nullif(p_payload ->> 'shopee_checkout_url', ''),
    v_product_subtotal, v_product_count, v_jastip_fee, v_shipping_fee,
    v_discount, v_total, 'awaiting_payment',
    case
      when v_deposit >= v_total and v_total > 0 then 'paid'
      when v_deposit > 0 then 'deposit_received'
      else 'unpaid'
    end,
    nullif(p_payload ->> 'admin_notes', '')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items')
  loop
    v_unit_id := nullif(v_item ->> 'unit_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::integer, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0);

    if v_unit_id is not null then
      if v_quantity <> 1 then
        raise exception 'A physical unit can only be assigned to a single-quantity item' using errcode = '22023';
      end if;
      select status, product_id into v_unit_status, v_unit_product_id
      from public.units where id = v_unit_id for update;
      if not found or v_unit_status <> 'available' then
        raise exception 'Selected physical unit is not available' using errcode = '22023';
      end if;
      if nullif(v_item ->> 'product_id', '')::uuid is distinct from v_unit_product_id then
        raise exception 'Selected unit does not match the chosen catalog product' using errcode = '22023';
      end if;
      update public.units set status = 'reserved' where id = v_unit_id;
    end if;

    insert into public.order_items (
      order_id, unit_id, product_id, product_name_snapshot,
      variant_snapshot, quantity, unit_price
    ) values (
      v_order_id,
      v_unit_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      trim(v_item ->> 'product_name_snapshot'),
      nullif(v_item ->> 'variant_snapshot', ''),
      v_quantity,
      v_unit_price
    );
  end loop;

  if v_deposit > 0 then
    if v_deposit > v_total then
      raise exception 'Deposit cannot exceed the order total' using errcode = '22023';
    end if;
    insert into public.payments (order_id, amount, payment_type, method, proof_url, received_at, notes)
    values (
      v_order_id, v_deposit, 'deposit',
      coalesce(v_request_method, nullif(p_payload ->> 'payment_method', ''), 'bank_transfer'),
      coalesce(v_request_proof_url, nullif(p_payload ->> 'payment_proof_url', '')),
      now(), 'Deposit dari request dicatat pada order final'
    );
  end if;

  if v_source_request_id is not null then
    update public.requests
    set deposit_payment_status = 'applied_to_order',
        status = 'converted'
    where id = v_source_request_id;
  end if;

  return query select v_order_id, v_order_code;
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to authenticated;


-- Add a payment/refund ledger entry and recalculate the order balance atomically.
-- Refunds and settlement amounts are entered explicitly by an admin; the function
-- does not infer a deposit percentage or an unavailable-item refund policy.
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_type text default 'settlement',
  p_method text default 'bank_transfer',
  p_notes text default null,
  p_proof_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12,2);
  v_current_net numeric(12,2);
  v_new_net numeric(12,2);
  v_has_settlement boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;
  if p_payment_type not in ('deposit', 'settlement', 'shipping', 'refund') then
    raise exception 'Unsupported payment type' using errcode = '22023';
  end if;

  select total_amount into v_total
  from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(case when payment_type = 'refund' then -amount else amount end), 0)
    into v_current_net
  from public.payments
  where order_id = p_order_id;

  if p_payment_type = 'refund' then
    if p_amount > v_current_net then
      raise exception 'Refund cannot exceed the net amount received' using errcode = '22023';
    end if;
    v_new_net := v_current_net - p_amount;
  else
    if v_current_net + p_amount > v_total then
      raise exception 'Payment would exceed the order total' using errcode = '22023';
    end if;
    v_new_net := v_current_net + p_amount;
  end if;

  insert into public.payments (order_id, amount, payment_type, method, proof_url, received_at, notes)
  values (
    p_order_id, p_amount, p_payment_type,
    coalesce(nullif(p_method, ''), 'bank_transfer'),
    nullif(p_proof_url, ''), now(), nullif(p_notes, '')
  );

  select exists (
    select 1 from public.payments
    where order_id = p_order_id and payment_type in ('settlement', 'shipping')
  ) into v_has_settlement;

  update public.orders
  set payment_status = case
    when v_new_net <= 0 and exists (
      select 1 from public.payments
      where order_id = p_order_id and payment_type = 'refund'
    ) then 'refunded'
    when v_new_net <= 0 then 'unpaid'
    when v_new_net >= v_total then 'paid'
    when v_has_settlement then 'partially_paid'
    else 'deposit_received'
  end
  where id = p_order_id;
end;
$$;

revoke all on function public.record_order_payment(uuid, numeric, text, text, text, text) from public;
grant execute on function public.record_order_payment(uuid, numeric, text, text, text, text) to authenticated;


-- A Shopee order cannot progress to fulfillment until the buyer's Shopee
-- username has been explicitly confirmed and recorded by the admin.
create or replace function public.guard_shopee_order_fulfillment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.checkout_method = 'shopee'
     and new.status in ('packing', 'shipped', 'completed')
     and (
       nullif(trim(new.shopee_username), '') is null
       or new.customer_shopee_confirmed_at is null
     ) then
    raise exception 'Confirm and record the customer Shopee username before fulfillment' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shopee_order_fulfillment on public.orders;
create trigger guard_shopee_order_fulfillment
  before update of status on public.orders
  for each row execute function public.guard_shopee_order_fulfillment();
