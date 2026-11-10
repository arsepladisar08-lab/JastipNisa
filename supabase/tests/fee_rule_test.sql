-- Run after applying the initial migration in a development Supabase project.
-- This checks the database-level fee rule against the agreed fee schedule.

do $$
begin
  if public.calculate_jastip_fee(0) <> 0 then
    raise exception 'Fee test failed for 0 products';
  end if;
  if public.calculate_jastip_fee(1) <> 15000 then
    raise exception 'Fee test failed for 1 product';
  end if;
  if public.calculate_jastip_fee(2) <> 25000 then
    raise exception 'Fee test failed for 2 products';
  end if;
  if public.calculate_jastip_fee(3) <> 35000 then
    raise exception 'Fee test failed for 3 products';
  end if;
  if public.calculate_jastip_fee(4) <> 45000 then
    raise exception 'Fee test failed for 4 products';
  end if;
  if public.calculate_jastip_fee(10) <> 105000 then
    raise exception 'Fee test failed for 10 products';
  end if;
  raise notice 'JastipNisa fee rule tests passed.';
end;
$$;
