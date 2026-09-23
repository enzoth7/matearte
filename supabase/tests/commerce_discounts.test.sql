begin;
select plan(20);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'discount-test@matearte.invalid', 'not-used',
  now(), now(), now()
), (
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'discount-other@matearte.invalid', 'not-used',
  now(), now(), now()
);

insert into public.commerce_discounts (
  id, code, discount_type, value, valid_from, valid_until, enabled
) values
  ('20000000-0000-4000-8000-000000000001', 'MATE10', 'percentage', 10, current_date - 1, current_date + 1, true),
  ('20000000-0000-4000-8000-000000000002', 'FUTURO', 'percentage', 15, current_date + 1, current_date + 2, true),
  ('20000000-0000-4000-8000-000000000003', 'FIJO500', 'fixed', 50000, current_date - 1, current_date + 1, true);

insert into public.commerce_discounts (
  id, code, discount_type, value, valid_from, valid_until, enabled,
  owner_user_id, applicability, redemption_limit, source_key
) values (
  '20000000-0000-4000-8000-000000000004', 'CUMPLE-00112233445566778899AABB',
  'percentage', 20, current_date, current_date + 30, true,
  '10000000-0000-4000-8000-000000000001', 'design_items', 1,
  'birthday:10000000-0000-4000-8000-000000000001:2026'
);

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

select is(
  (public.validate_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000
  ) ->> 'discountMinor')::bigint,
  20000::bigint,
  'birthday benefit discounts only the personalized subtotal in a mixed cart'
);

select is(
  (public.validate_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000
  ) ->> 'eligibleSubtotalMinor')::bigint,
  100000::bigint,
  'birthday validation exposes the authoritative eligible subtotal'
);

select throws_ok(
  $$select public.validate_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 0
  )$$,
  'P0001', 'discount:not_applicable',
  'birthday benefit requires a personalized design item'
);

select throws_ok(
  $$select public.validate_commerce_discount(
    '10000000-0000-4000-8000-000000000002',
    'CUMPLE-00112233445566778899AABB', 200000, 100000
  )$$,
  'P0001', 'discount:not_found',
  'a birthday code does not reveal itself to another account'
);

select lives_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000,
    '30000000-0000-4000-8000-000000000010', now() + interval '30 minutes'
  )$$,
  'the owner can reserve the birthday benefit'
);

select throws_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000,
    '30000000-0000-4000-8000-000000000011', now() + interval '30 minutes'
  )$$,
  'P0001', 'discount:in_use',
  'a one-use birthday benefit cannot be reserved by two checkouts at once'
);

select ok(
  public.release_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000010'
  ),
  'a failed or cancelled payment releases the birthday benefit'
);

select lives_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000,
    '30000000-0000-4000-8000-000000000011', now() + interval '30 minutes'
  )$$,
  'the birthday benefit can be reserved again after a failed payment'
);

insert into public.orders (
  id, user_id, status, items_subtotal_minor, total_minor,
  shipping_method, checkout_idempotency_key, customer_snapshot
) values (
  '40000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  'ready_for_fulfillment', 200000, 200000,
  'pickup', '30000000-0000-4000-8000-000000000011',
  '{"purchaseFlow":"wholesale_bank_transfer"}'::jsonb
);

select lives_ok(
  $$select private.redeem_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000011',
    '40000000-0000-4000-8000-000000000010'
  )$$,
  'a confirmed payment redeems the reserved birthday benefit'
);

select is(
  (select count(*) from public.commerce_discount_usages
   where discount_id = '20000000-0000-4000-8000-000000000004'
     and status = 'redeemed'),
  1::bigint,
  'the confirmed birthday benefit has exactly one redemption'
);

select throws_ok(
  $$select public.validate_commerce_discount(
    '10000000-0000-4000-8000-000000000001',
    'CUMPLE-00112233445566778899AABB', 200000, 100000
  )$$,
  'P0001', 'discount:already_used',
  'the birthday benefit cannot be used after a confirmed payment'
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

select lives_ok(
  $$select public.reserve_commerce_discount(
    '10000000-0000-4000-8000-000000000001', 'MATE10', 100000,
    '30000000-0000-4000-8000-000000000002', now() + interval '30 minutes'
  )$$,
  'the same customer may reserve the code for another checkout'
);

select is(
  (select count(*) from public.commerce_discount_usages
   where discount_id = '20000000-0000-4000-8000-000000000001'
     and user_id = '10000000-0000-4000-8000-000000000001'),
  2::bigint,
  'each checkout keeps a separate usage record for the same customer'
);

set local role authenticated;
select is_empty(
  $$select id from public.commerce_discounts$$,
  'a regular authenticated customer cannot enumerate discount codes'
);

reset role;
select * from finish();
rollback;
