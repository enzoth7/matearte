-- Only online orders get a dispatch notice. Wholesale
-- bank-transfer orders continue to show tracking in the account instead.
create or replace function private.enqueue_shipped_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.channel, '') not in ('Web', 'Mayorista web')
     or new.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then
    return new;
  end if;

  if new.status = 'shipped' and new.status is distinct from old.status then
    perform private.enqueue_commerce_email(
      new.id,
      'customer_order_shipped',
      'customer',
      new.customer_snapshot ->> 'email',
      jsonb_build_object(
        'shippingCarrier', new.shipping_carrier,
        'trackingCode', new.tracking_code
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_shipped_order_email() from public, anon, authenticated;

-- A worker can crash after claiming a job. Reclaim it after fifteen minutes;
-- Resend receives the same idempotency key for every attempt.
create or replace function public.claim_commerce_email_jobs(
  p_order_id uuid default null,
  p_limit integer default 20
)
returns setof public.commerce_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select email.id
    from public.commerce_email_outbox email
    where email.attempt_count < 5
      and (
        (email.status in ('pending', 'failed') and email.available_at <= now())
        or (email.status = 'sending' and email.claimed_at < now() - interval '15 minutes')
      )
      and email.event_type in (
        'customer_order_received',
        'customer_custom_approved',
        'customer_order_ready',
        'customer_order_shipped',
        'admin_payment_confirmed'
      )
      and (p_order_id is null or email.order_id = p_order_id)
    order by email.created_at, email.id
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  update public.commerce_email_outbox email
  set status = 'sending',
      attempt_count = email.attempt_count + 1,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  from candidates
  where email.id = candidates.id
  returning email.*;
end;
$$;

revoke all on function public.claim_commerce_email_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_commerce_email_jobs(uuid, integer) to service_role;

-- The server dispatches immediately on shipment. This schedule drains any
-- jobs left behind by a network error without exposing the worker secret.
select cron.schedule(
  'matearte-commerce-email-worker',
  '*/5 * * * *',
  $schedule$
    select net.http_post(
      url := 'https://agdkljuulwjwjasftcce.supabase.co/functions/v1/commerce-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'matearte_lifecycle_service_role')
      ),
      body := '{"source":"cron"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $schedule$
);
