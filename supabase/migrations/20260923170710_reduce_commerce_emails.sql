-- Keep one customer confirmation and one admin notification when a payment is
-- confirmed. Later production and fulfillment milestones remain available.
-- Wholesale bank-transfer orders continue to use in-app status updates only.

create or replace function private.enqueue_commerce_email(
  p_order_id uuid,
  p_event_type text,
  p_recipient_kind text,
  p_recipient_email text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in (
    'customer_order_received',
    'customer_custom_approved',
    'customer_order_ready',
    'customer_order_shipped',
    'admin_payment_confirmed'
  ) then
    return;
  end if;

  insert into public.commerce_email_outbox (
    order_id, event_type, recipient_kind, recipient_email, payload
  ) values (
    p_order_id,
    p_event_type,
    p_recipient_kind,
    nullif(lower(btrim(p_recipient_email)), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (order_id, event_type) do nothing;
end;
$$;

revoke all on function private.enqueue_commerce_email(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.enqueue_commerce_email(uuid, text, text, text, jsonb)
  to service_role;

create or replace function private.enqueue_order_status_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_email text := new.customer_snapshot ->> 'email';
  v_is_confirmed_payment boolean := new.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );
  v_was_confirmed_payment boolean;
begin
  if new.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then
    return new;
  end if;

  if new.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
     and new.paid_at is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_is_confirmed_payment then
      perform private.enqueue_commerce_email(
        new.id, 'customer_order_received', 'customer', v_customer_email
      );
      perform private.enqueue_commerce_email(
        new.id, 'admin_payment_confirmed', 'admin'
      );
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_was_confirmed_payment := old.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );

  if not v_was_confirmed_payment and v_is_confirmed_payment then
    perform private.enqueue_commerce_email(
      new.id, 'customer_order_received', 'customer', v_customer_email
    );
    perform private.enqueue_commerce_email(
      new.id, 'admin_payment_confirmed', 'admin'
    );
  end if;

  if new.status = 'ready_for_production' then
    perform private.enqueue_commerce_email(
      new.id, 'customer_custom_approved', 'customer', v_customer_email
    );
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_order_status_emails()
  from public, anon, authenticated;

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
    where email.status in ('pending', 'failed')
      and email.attempt_count < 5
      and email.available_at <= now()
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

revoke all on function public.claim_commerce_email_jobs(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_commerce_email_jobs(uuid, integer)
  to service_role;

-- Sent rows remain as delivery history. Unsent obsolete jobs are discarded.
delete from public.commerce_email_outbox
where status <> 'sent'
  and event_type in (
    'customer_payment_confirmed',
    'customer_custom_rejected_refunded',
    'customer_international_received',
    'customer_payment_failed',
    'customer_order_cancelled',
    'customer_order_refunded',
    'admin_order_created',
    'admin_custom_review_required',
    'admin_payment_review_required'
  );
