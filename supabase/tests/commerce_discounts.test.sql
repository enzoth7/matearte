begin;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'discount-test@matearte.invalid', 'not-used',
  now(), now(), now()
);

insert into public.commerce_discounts (
  id, code, discount_type, value, valid_from, valid_until, enabled
) values
  ('20000000-0000-4000-8000-000000000001', 'MATE10', 'percentage', 10, current_date - 1, current_date + 1, true),
  ('20000000-0000-4000-8000-000000000002', 'FUTURO', 'percentage', 15, current_date + 1, current_date + 2, true),
  ('20000000-0000-4000-8000-000000000003', 'FIJO500', 'fixed', 50000, current_date - 1, current_date + 1, true);

select is(
  (public.validate_commerce_discount('10000000-0000-4000-8000-000000000001', ' mate10 ', 100000) ->> 'discountMinor')::bigint,
  10000::bigint,
  'percentage codes normalize and calculate in minor units'
);

select is(
  (public.validate_commerce_discount('10000000-0000-4000-8000-000000000001', 'FIJO500', 100000) ->> 'discountMinor')::bigint,
  50000::bigint,
  'fixed codes calculate in minor units'
);

select throws_ok(
  $$select public.validate_commerce_discount('10000000-0000-4000-8000-000000000001', 'FUTURO', 100000)$$,
  'P0001', 'discount:not_started', 'future codes are rejected'
);

select throws_ok(
  $$select public.validate_commerce_discount('10000000-0000-4000-8000-000000000001', 'FIJO500', 50000)$$,
  'P0001', 'discount:not_applicable', 'a discount cannot reduce the product subtotal to zero'
);

select lives_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001', 'MATE10', 100000,
    '30000000-0000-4000-8000-000000000001', now() + interval '30 minutes'
  )$$,
  'the first checkout reserves the customer discount'
);

select lives_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001', 'MATE10', 100000,
    '30000000-0000-4000-8000-000000000001', now() + interval '30 minutes'
  )$$,
  'the same checkout key is idempotent'
);

select throws_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001', 'MATE10', 100000,
    '30000000-0000-4000-8000-000000000002', now() + interval '30 minutes'
  )$$,
  'P0001', 'discount:in_use', 'parallel checkout attempts are rejected'
);

set local role authenticated;
select is_empty(
  $$select id from public.commerce_discounts$$,
  'a regular authenticated customer cannot enumerate discount codes'
);

reset role;
select * from finish();
rollback;
