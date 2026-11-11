-- Manual SQL regression test for 202611110002_unit_reservation_integrity.sql.
-- Run after both migrations in a disposable Supabase project / SQL Editor.
-- The transaction is rolled back; no permanent fixture data is retained.

begin;

do $test$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_unit_id uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_status text;
  v_reserved_order_id uuid;
begin
  insert into public.catalog_products (
    name, slug, official_product_url, source_url
  ) values (
    'Reservation Test Product',
    'reservation-test-' || replace(gen_random_uuid()::text, '-', ''),
    'https://example.com/test-product',
    'https://example.com'
  ) returning id into v_product_id;

  insert into public.catalog_variants (product_id, name)
  values (v_product_id, 'Black')
  returning id into v_variant_id;

  insert into public.units (
    unit_code, product_id, variant_id, status
  ) values (
    'TEST-' || replace(gen_random_uuid()::text, '-', ''),
    v_product_id, v_variant_id, 'available'
  ) returning id into v_unit_id;

  insert into public.orders (
    order_code, customer_name, customer_phone, shipping_address, total_amount, product_count
  ) values (
    'JN-TEST-' || replace(gen_random_uuid()::text, '-', ''),
    'Test Buyer A', '620000000001', 'Test Address A', 100000, 1
  ) returning id into v_order_a;

  insert into public.orders (
    order_code, customer_name, customer_phone, shipping_address, total_amount, product_count
  ) values (
    'JN-TEST-' || replace(gen_random_uuid()::text, '-', ''),
    'Test Buyer B', '620000000002', 'Test Address B', 100000, 1
  ) returning id into v_order_b;

  -- Variant mismatch must fail.
  begin
    insert into public.order_items (
      order_id, unit_id, product_id, product_name_snapshot, variant_snapshot, quantity, unit_price
    ) values (
      v_order_a, v_unit_id, v_product_id, 'Reservation Test Product', 'Rose', 1, 100000
    );
    raise exception 'TEST FAILED: mismatched unit variant was accepted';
  exception
    when sqlstate '22023' then null;
  end;

  insert into public.order_items (
    order_id, unit_id, product_id, product_name_snapshot, variant_snapshot, quantity, unit_price
  ) values (
    v_order_a, v_unit_id, v_product_id, 'Reservation Test Product', 'Black', 1, 100000
  );

  select status, reserved_order_id
    into v_status, v_reserved_order_id
  from public.units where id = v_unit_id;

  if v_status <> 'reserved' or v_reserved_order_id <> v_order_a then
    raise exception 'TEST FAILED: unit was not reserved by the first order';
  end if;

  -- A second order cannot claim an actively reserved unit.
  begin
    insert into public.order_items (
      order_id, unit_id, product_id, product_name_snapshot, variant_snapshot, quantity, unit_price
    ) values (
      v_order_b, v_unit_id, v_product_id, 'Reservation Test Product', 'Black', 1, 100000
    );
    raise exception 'TEST FAILED: a second active order claimed the same unit';
  exception
    when sqlstate '23505' then null;
  end;

  -- Cancellation before shipment releases the reservation but keeps history.
  update public.orders set status = 'cancelled' where id = v_order_a;

  select status, reserved_order_id
    into v_status, v_reserved_order_id
  from public.units where id = v_unit_id;

  if v_status <> 'available' or v_reserved_order_id is not null then
    raise exception 'TEST FAILED: cancelled order did not release its unit';
  end if;

  -- The same physical unit can now be assigned to a different order.
  insert into public.order_items (
    order_id, unit_id, product_id, product_name_snapshot, variant_snapshot, quantity, unit_price
  ) values (
    v_order_b, v_unit_id, v_product_id, 'Reservation Test Product', 'Black', 1, 100000
  );

  select status, reserved_order_id
    into v_status, v_reserved_order_id
  from public.units where id = v_unit_id;

  if v_status <> 'reserved' or v_reserved_order_id <> v_order_b then
    raise exception 'TEST FAILED: unit could not be reassigned after cancellation';
  end if;

  -- Direct stock reset must fail while the second order is active.
  begin
    update public.units set status = 'available' where id = v_unit_id;
    raise exception 'TEST FAILED: active reservation was manually released';
  exception
    when sqlstate '22023' then null;
  end;

  raise notice 'PASS: unit/product/variant consistency, active reservation, cancellation release and reassignment.';
end;
$test$;

rollback;
