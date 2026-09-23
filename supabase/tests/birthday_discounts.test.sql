begin;
select plan(17);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values
  (
    '41000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'birthday-target@matearte.invalid', 'not-used',
    now(), now(), now()
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'birthday-other@matearte.invalid', 'not-used',
    now(), now(), now()
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'birthday-leap@matearte.invalid', 'not-used',
    now(), now(), now()
  );

insert into public.customer_profiles (user_id, full_name, birth_date) values
  ('41000000-0000-4000-8000-000000000001', 'Ana Cumple', date '1990-01-15'),
  ('41000000-0000-4000-8000-000000000002', 'Otra Persona', date '1990-01-16'),
  ('41000000-0000-4000-8000-000000000003', 'Persona Bisiesta', date '1992-02-29');

select is(
  public.queue_upcoming_birthday_emails(date '2026-01-05'),
  1,
  'the birthday job queues exactly ten days before the birthday'
);

select is(
  (select count(*) from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  1::bigint,
  'one birthday email exists for the account and birthday year'
);

select matches(
  (select code from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  '^CUMPLE-[0-9A-F]{24}$',
  'the generated birthday code carries 96 random bits in the supported format'
);

select is(
  (select owner_user_id from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  '41000000-0000-4000-8000-000000000001'::uuid,
  'the generated code belongs to its recipient account'
);

select is(
  (select applicability from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  'design_items',
  'the generated code applies only to customizer designs'
);

select is(
  (select redemption_limit from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  1,
  'the generated code is single-use'
);

select is(
  (select valid_from from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  date '2026-01-05',
  'validity starts when the email is queued'
);

select is(
  (select valid_until from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  date '2026-02-04',
  'validity ends thirty days after generation'
);

select is(
  (select payload ->> 'discountCode' from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  (select code from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  'the email payload contains the persisted code'
);

select is(
  (select payload ->> 'discountPercent' from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  '20%',
  'the email payload communicates the twenty-percent benefit'
);

select is(
  (select payload ->> 'discountValidUntil' from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  '2026-02-04',
  'the email payload includes the exact final day of validity'
);

select is(
  (select count(*) from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000002:2026'),
  0::bigint,
  'birthdays outside the ten-day target are not queued'
);

update public.lifecycle_email_outbox
set status = 'failed', attempt_count = 1, available_at = now() - interval '1 minute',
    last_error = 'simulated provider failure'
where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026';

select is(
  public.queue_upcoming_birthday_emails(date '2026-01-05'),
  1,
  'a failed birthday delivery keeps its existing outbox job'
);

select is(
  (select payload ->> 'discountCode' from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  (select code from public.commerce_discounts where source_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  'a birthday email retry reuses exactly the same code'
);

select is(
  (select attempt_count from public.lifecycle_email_outbox where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026'),
  1,
  'refreshing the birthday queue does not reset failed-delivery attempts'
);

update public.lifecycle_email_outbox
set status = 'sent', sent_at = now()
where event_key = 'birthday:41000000-0000-4000-8000-000000000001:2026';

select is(
  public.queue_upcoming_birthday_emails(date '2026-01-05'),
  0,
  'a sent birthday email is idempotent'
);

select is(
  public.queue_upcoming_birthday_emails(date '2025-02-18'),
  1,
  'a February 29 birthday is queued for February 28 in a non-leap year'
);

select * from finish();
rollback;
