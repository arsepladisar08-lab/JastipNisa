-- JastipNisa workflow integrity migration.
-- Apply after 202611110001_initial_schema.sql in a development Supabase project.
-- Keeps historical order_items while enforcing one active physical-unit reservation.

alter table public.units
  add column if not exists reserved_order_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'units_reserved_order_id_fkey'
      and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_reserved_order_id_fkey
      foreign key (reserved_order_id)
      references public.orders(id)
      on delete set null;
  end if;
end;
$$;

-- Fail loudly rather than silently choosing a winner when legacy data already
-- assigns one physical unit to multiple non-cancelled orders.
do $$
declare
  v_conflicting_unit uuid;
begin
  select oi.unit_id
    into v_conflicting_unit
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.unit_id is not null
    and o.status <> 'cancelled'
  group by oi.unit_id
  having count(*) > 1
  limit 1;

  if v_conflicting_unit is not null then
    raise exception 'Unit % is linked to multiple active order items. Reconcile this inventory before applying migration 002.', v_conflicting_unit;
  end if;
end;
$$;

-- Backfill the current active assignment. Cancelled orders remain in order_items
-- as history, but they no longer reserve the physical unit.
with active_assignments as (
  select distinct on (oi.unit_id)
    oi.unit_id,
    oi.order_id,
    o.status as order_status
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.unit_id is not null
    and o.status <> 'cancelled'
  order by oi.unit_id, o.created_at desc
)
update public.units u
set reserved_order_id = a.order_id,
    status = case
      when a.order_status = 'packing' then 'packed'
      when a.order_status = 'shipped' then 'shipped'
      when a.order_status = 'completed' then 'completed'
      when u.status in ('sold', 'shipped', 'completed') then u.status
      else 'reserved'
    end
from active_assignments a
where u.id = a.unit_id;

update public.units u
set status = 'available',
    reserved_order_id = null
where u.reserved_order_id is null
  and u.status in ('reserved', 'packed')
  and exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.unit_id = u.id and o.status = 'cancelled'
  )
  and not exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.unit_id = u.id and o.status <> 'cancelled'
  );

create index if not exists idx_units_reserved_order
  on public.units(reserved_order_id)
  where reserved_order_id is not null;

-- Validate and lock a unit before an order item can claim it. The AFTER trigger
-- writes the reservation reference once the order_items row exists.
create or replace function public.guard_order_item_unit_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_product_id uuid;
  v_unit_variant_id uuid;
  v_unit_status text;
  v_reserved_order_id uuid;
  v_variant_name text;
  v_target_order_status text;
begin
  if tg_op = 'UPDATE' then
    if old.unit_id is not null and (
      new.unit_id is distinct from old.unit_id
      or new.order_id is distinct from old.order_id
    ) then
      raise exception 'A physical unit already assigned to an order item cannot be replaced. Cancel the order before reassigning the unit.'
        using errcode = '22023';
    end if;
    if old.unit_id is not null and new.unit_id = old.unit_id then
      select product_id, variant_id
        into v_unit_product_id, v_unit_variant_id
      from public.units
      where id = new.unit_id
      for update;

      if not found or v_unit_product_id is distinct from new.product_id then
        raise exception 'Assigned physical unit must remain linked to its original catalog product.'
          using errcode = '22023';
      end if;

      if v_unit_variant_id is not null and nullif(trim(new.variant_snapshot), '') is not null then
        select name into v_variant_name
        from public.catalog_variants
        where id = v_unit_variant_id;

        if lower(trim(coalesce(v_variant_name, ''))) <> lower(trim(new.variant_snapshot)) then
          raise exception 'Assigned physical unit variant does not match the order item variant.'
            using errcode = '22023';
        end if;
      end if;
      return new;
    end if;
  end if;

  if new.unit_id is null then
    return new;
  end if;

  if new.quantity <> 1 then
    raise exception 'A physical unit can only be linked to an order item with quantity one.'
      using errcode = '22023';
  end if;

  select status into v_target_order_status
  from public.orders
  where id = new.order_id
  for update;

  if not found then
    raise exception 'Target order does not exist.'
      using errcode = 'P0002';
  end if;
  if v_target_order_status in ('cancelled', 'shipped', 'completed') then
    raise exception 'A unit cannot be assigned to a cancelled or already fulfilled order.'
      using errcode = '22023';
  end if;

  select product_id, variant_id, status, reserved_order_id
    into v_unit_product_id, v_unit_variant_id, v_unit_status, v_reserved_order_id
  from public.units
  where id = new.unit_id
  for update;

  if not found then
    raise exception 'Selected physical unit does not exist.'
      using errcode = 'P0002';
  end if;

  if v_unit_product_id is distinct from new.product_id then
    raise exception 'Selected physical unit does not match the catalog product on this order item.'
      using errcode = '22023';
  end if;

  if v_reserved_order_id is not null and v_reserved_order_id <> new.order_id then
    raise exception 'Selected physical unit is already reserved by another active order.'
      using errcode = '23505';
  end if;

  if v_unit_status not in ('available', 'reserved') then
    raise exception 'Selected physical unit is not available for reservation.'
      using errcode = '22023';
  end if;

  if v_unit_variant_id is not null and nullif(trim(new.variant_snapshot), '') is not null then
    select name into v_variant_name
    from public.catalog_variants
    where id = v_unit_variant_id;

    if lower(trim(coalesce(v_variant_name, ''))) <> lower(trim(new.variant_snapshot)) then
      raise exception 'Selected physical unit variant does not match the order item variant.'
        using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.unit_id = new.unit_id
      and oi.id is distinct from new.id
      and oi.order_id = new.order_id
      and o.status <> 'cancelled'
  ) then
    raise exception 'A physical unit cannot appear twice in the same active order.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.assign_order_item_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null
     and (tg_op = 'INSERT' or old.unit_id is null) then
    update public.units
    set reserved_order_id = new.order_id,
        status = 'reserved'
    where id = new.unit_id
      and (reserved_order_id is null or reserved_order_id = new.order_id);

    if not found then
      raise exception 'Physical unit reservation was claimed by another order.'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_item_unit_link on public.order_items;
create trigger guard_order_item_unit_link
  before insert or update of unit_id, order_id, quantity, product_id, variant_snapshot
  on public.order_items
  for each row execute function public.guard_order_item_unit_link();

drop trigger if exists assign_order_item_unit on public.order_items;
create trigger assign_order_item_unit
  after insert or update of unit_id
  on public.order_items
  for each row execute function public.assign_order_item_unit();

-- Prevent clearing a reservation while its order is still active.
create or replace function public.guard_unit_reservation_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
begin
  if new.reserved_order_id is not distinct from old.reserved_order_id then
    return new;
  end if;

  if new.reserved_order_id is not null then
    if not exists (
      select 1
      from public.order_items oi
      where oi.unit_id = new.id
        and oi.order_id = new.reserved_order_id
    ) then
      raise exception 'A unit reservation must reference an existing order item.'
        using errcode = '22023';
    end if;
  elsif old.reserved_order_id is not null then
    select status into v_order_status
    from public.orders
    where id = old.reserved_order_id;

    if found and v_order_status <> 'cancelled' then
      raise exception 'A reserved unit can only be released by cancelling its order before shipment.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_unit_reservation_reference on public.units;
create trigger guard_unit_reservation_reference
  before update of reserved_order_id
  on public.units
  for each row execute function public.guard_unit_reservation_reference();

-- Also reject a direct status reset if the linked order has not been cancelled.
create or replace function public.guard_unit_status_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
begin
  if new.status = 'available' and old.status is distinct from 'available' then
    if old.reserved_order_id is not null then
      select status into v_order_status
      from public.orders
      where id = old.reserved_order_id;

      if found and v_order_status <> 'cancelled' then
        raise exception 'A unit reserved by an active order cannot be marked available.'
          using errcode = '22023';
      end if;
    elsif old.status in ('reserved', 'packed', 'shipped', 'completed', 'sold') then
      raise exception 'A unit in fulfillment cannot be marked available without a cancelled order.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_unit_status_release on public.units;
create trigger guard_unit_status_release
  before update of status
  on public.units
  for each row execute function public.guard_unit_status_release();

-- Status is derived from order fulfillment. Cancellation before shipment releases
-- only units actively reserved by this order; historical item references remain.
create or replace function public.sync_order_unit_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'packing' then
    update public.units
    set status = 'packed'
    where reserved_order_id = new.id and status = 'reserved';

  elsif new.status = 'shipped' then
    update public.units
    set status = 'shipped'
    where reserved_order_id = new.id and status in ('reserved', 'packed');

  elsif new.status = 'completed' then
    update public.units
    set status = 'completed'
    where reserved_order_id = new.id and status in ('reserved', 'packed', 'shipped');

  elsif new.status = 'cancelled' and old.status not in ('shipped', 'completed') then
    update public.units
    set status = 'available',
        reserved_order_id = null
    where reserved_order_id = new.id
      and status in ('reserved', 'packed');
  end if;

  return new;
end;
$$;

-- Update the existing trigger target to the reservation-aware implementation.
drop trigger if exists sync_order_unit_status on public.orders;
create trigger sync_order_unit_status
  after update of status on public.orders
  for each row execute function public.sync_order_unit_status();

-- One transaction for shipment upsert + order fulfillment state. This avoids the
-- split-write failure where a waybill is saved but the order status is not.
create or replace function public.record_order_shipment(
  p_order_id uuid,
  p_courier text,
  p_tracking_number text,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
  v_checkout_method text;
  v_shopee_username text;
  v_shopee_confirmed_at timestamptz;
  v_existing_shipment_status text;
  v_existing_shipped_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_order_id is null or p_status is null or p_status not in ('preparing', 'shipped', 'delivered', 'issue') then
    raise exception 'Shipment order and supported status are required' using errcode = '22023';
  end if;

  if p_status in ('shipped', 'delivered') and nullif(trim(p_tracking_number), '') is null then
    raise exception 'Tracking number is required before shipment can be marked sent or delivered'
      using errcode = '22023';
  end if;

  select status, checkout_method, shopee_username, customer_shopee_confirmed_at
    into v_order_status, v_checkout_method, v_shopee_username, v_shopee_confirmed_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order_status = 'cancelled' then
    raise exception 'A cancelled order cannot be shipped' using errcode = '22023';
  end if;

  if v_checkout_method = 'shopee'
     and p_status in ('preparing', 'shipped', 'delivered')
     and (nullif(trim(v_shopee_username), '') is null or v_shopee_confirmed_at is null) then
    raise exception 'Confirm and record the customer Shopee username before fulfillment'
      using errcode = '22023';
  end if;

  select status, shipped_at
    into v_existing_shipment_status, v_existing_shipped_at
  from public.shipments
  where order_id = p_order_id
  for update;

  if v_existing_shipment_status = 'delivered' and p_status <> 'delivered' then
    raise exception 'Delivered shipment status cannot be moved backwards' using errcode = '22023';
  end if;

  if p_status = 'preparing'
     and (
       v_existing_shipped_at is not null
       or v_order_status in ('shipped', 'completed')
       or v_existing_shipment_status in ('shipped', 'delivered')
     ) then
    raise exception 'A shipment that has already left cannot return to packing' using errcode = '22023';
  end if;

  insert into public.shipments (
    order_id, courier, tracking_number, status, processed_at, shipped_at,
    estimated_processing_days, notes
  ) values (
    p_order_id,
    nullif(trim(p_courier), ''),
    nullif(trim(p_tracking_number), ''),
    p_status,
    now(),
    case when p_status in ('shipped', 'delivered') then now() else null end,
    '2–3 hari kerja',
    nullif(trim(p_notes), '')
  )
  on conflict (order_id) do update
  set courier = excluded.courier,
      tracking_number = excluded.tracking_number,
      status = excluded.status,
      processed_at = coalesce(public.shipments.processed_at, excluded.processed_at),
      shipped_at = case
        when excluded.status in ('shipped', 'delivered')
          then coalesce(public.shipments.shipped_at, excluded.shipped_at)
        else public.shipments.shipped_at
      end,
      notes = coalesce(excluded.notes, public.shipments.notes),
      updated_at = now();

  update public.orders
  set status = case p_status
    when 'preparing' then 'packing'
    when 'shipped' then 'shipped'
    when 'delivered' then 'completed'
    else 'issue'
  end
  where id = p_order_id;
end;
$$;

revoke all on function public.record_order_shipment(uuid, text, text, text, text) from public;
grant execute on function public.record_order_shipment(uuid, text, text, text, text) to authenticated;

-- Direct order updates cannot bypass the shipment record. Fulfillment states are
-- written only after the matching shipment state and tracking timestamp exist.
create or replace function public.guard_order_fulfillment_has_shipment()
returns trigger
language plpgsql
set search_path = public
as $
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'shipped' and not exists (
    select 1
    from public.shipments s
    where s.order_id = new.id
      and s.status = 'shipped'
      and s.shipped_at is not null
      and nullif(trim(s.tracking_number), '') is not null
  ) then
    raise exception 'Record courier, tracking number and shipment date before marking the order as shipped.'
      using errcode = '22023';
  end if;

  if new.status = 'completed' and not exists (
    select 1
    from public.shipments s
    where s.order_id = new.id
      and s.status = 'delivered'
      and s.shipped_at is not null
  ) then
    raise exception 'Record delivery confirmation before marking the order as completed.'
      using errcode = '22023';
  end if;

  return new;
end;
$;

drop trigger if exists guard_order_fulfillment_has_shipment on public.orders;
create trigger guard_order_fulfillment_has_shipment
  before update of status on public.orders
  for each row execute function public.guard_order_fulfillment_has_shipment();
