-- Domestic delivery is a method, not a fixed price zone. Keep the option ID
-- used by checkout and normalize old order snapshots without changing their
-- delivery method, customer address, or charged amount.
update public.shipping_rates
set name = 'Envío a domicilio',
    departments = '{}'::text[],
    rate_minor = 0
where code = '1'
  and is_pickup = false;

update public.orders
set shipping_snapshot = jsonb_build_object(
  'name', 'Envío a domicilio',
  'is_pickup', false,
  'paymentTiming', 'on_delivery'
)
where shipping_method = 'national_shipping'
  and shipping_snapshot->>'name' is distinct from 'Envío a domicilio';
