create table public.commerce_email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'customer_order_received',
    'customer_payment_confirmed',
    'customer_custom_approved',
    'customer_custom_rejected_refunded',
    'customer_order_ready',
    'customer_order_shipped',
    'customer_international_received',
    'customer_payment_failed',
    'customer_order_cancelled',
    'customer_order_refunded',
    'admin_order_created',
    'admin_payment_confirmed',
    'admin_custom_review_required',
    'admin_payment_review_required'
  )),
  recipient_kind text not null check (recipient_kind in ('customer', 'admin')),
  recipient_email text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  provider_message_id text,
  last_error text,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_type)
);

create index commerce_email_outbox_order_idx on public.commerce_email_outbox (order_id, created_at);
create index commerce_email_outbox_pending_idx on public.commerce_email_outbox (available_at, created_at)
where status in ('pending', 'failed') and attempt_count < 5;

revoke all on public.commerce_email_outbox from public, anon, authenticated;
grant all on public.commerce_email_outbox to service_role;
alter table public.commerce_email_outbox enable row level security;

create policy commerce_email_outbox_backend_only on public.commerce_email_outbox
for all to anon, authenticated using (false) with check (false);

create trigger commerce_email_outbox_updated_at
before update on public.commerce_email_outbox
for each row execute function private.set_updated_at();

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

revoke all on function private.enqueue_commerce_email(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.enqueue_commerce_email(uuid, text, text, text, jsonb) to service_role;

create or replace function private.enqueue_order_status_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_email text := new.customer_snapshot ->> 'email';
  v_has_rejected_custom boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.shipping_method = 'international_coordination' then
      perform private.enqueue_commerce_email(new.id, 'customer_international_received', 'customer', v_customer_email);
    else
      perform private.enqueue_commerce_email(new.id, 'customer_order_received', 'customer', v_customer_email);
    end if;
    perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('paid_pending_review', 'ready_for_fulfillment') then
    perform private.enqueue_commerce_email(new.id, 'customer_payment_confirmed', 'customer', v_customer_email);
    perform private.enqueue_commerce_email(new.id, 'admin_payment_confirmed', 'admin');
  end if;

  if new.status = 'paid_pending_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_custom_review_required', 'admin');
  elsif new.status = 'ready_for_production' then
    perform private.enqueue_commerce_email(new.id, 'customer_custom_approved', 'customer', v_customer_email);
  elsif new.status = 'payment_failed' then
    perform private.enqueue_commerce_email(new.id, 'customer_payment_failed', 'customer', v_customer_email);
  elsif new.status = 'cancelled' then
    perform private.enqueue_commerce_email(new.id, 'customer_order_cancelled', 'customer', v_customer_email);
  elsif new.status = 'manual_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
  elsif new.status = 'refunded' then
    select exists (
      select 1 from public.order_items
      where order_id = new.id and requires_review and review_status = 'rejected'
    ) into v_has_rejected_custom;
    perform private.enqueue_commerce_email(
      new.id,
      case when v_has_rejected_custom
        then 'customer_custom_rejected_refunded'
        else 'customer_order_refunded'
      end,
      'customer',
      v_customer_email
    );
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_order_status_emails() from public, anon, authenticated;

create trigger orders_enqueue_commerce_emails
after insert or update of status on public.orders
for each row execute function private.enqueue_order_status_emails();

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

create or replace function public.queue_commerce_fulfillment_email(
  p_order_id uuid,
  p_stage text,
  p_tracking_code text default null,
  p_tracking_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_stage is null or p_stage not in ('ready', 'shipped') then
    raise exception 'Etapa de entrega inválida';
  end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Pedido inexistente'; end if;
  perform private.enqueue_commerce_email(
    v_order.id,
    case when p_stage = 'ready' then 'customer_order_ready' else 'customer_order_shipped' end,
    'customer',
    v_order.customer_snapshot ->> 'email',
    jsonb_strip_nulls(jsonb_build_object('trackingCode', nullif(btrim(p_tracking_code), ''), 'trackingUrl', nullif(btrim(p_tracking_url), '')))
  );
end;
$$;

revoke all on function public.queue_commerce_fulfillment_email(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.queue_commerce_fulfillment_email(uuid, text, text, text) to service_role;

comment on table public.commerce_email_outbox is
'Backend-only, idempotent transactional email queue. No email provider credentials are stored in Postgres.';
