-- PayPal checkout rows are payment sessions until PayPal confirms a capture.
-- They remain available to the service role for payment orchestration, but are
-- not customer-visible and cannot enqueue commerce emails before confirmation.

create or replace function private.set_paypal_order_expiration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
     and new.status = 'pending_payment'
     and new.reservation_expires_at is null then
    new.reservation_expires_at := now() + interval '2 hours';
  end if;
  return new;
end;
$$;

revoke all on function private.set_paypal_order_expiration() from public, anon, authenticated;

drop trigger if exists orders_set_paypal_expiration on public.orders;
create trigger orders_set_paypal_expiration
before insert on public.orders
for each row execute function private.set_paypal_order_expiration();

drop policy if exists orders_own_or_admin_read on public.orders;
create policy orders_own_or_admin_read
on public.orders for select to authenticated
using (
  (select private.is_commerce_admin())
  or (
    (select auth.uid()) = user_id
    and not (
      customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
      and paid_at is null
    )
  )
);

drop policy if exists order_items_own_or_admin_read on public.order_items;
create policy order_items_own_or_admin_read
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and (
        (select private.is_commerce_admin())
        or (
          order_row.user_id = (select auth.uid())
          and not (
            order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
            and order_row.paid_at is null
          )
        )
      )
  )
);

drop policy if exists payments_own_or_admin_read on public.commerce_payments;
create policy payments_own_or_admin_read
on public.commerce_payments for select to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and (
        (select private.is_commerce_admin())
        or (
          order_row.user_id = (select auth.uid())
          and not (
            order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
            and order_row.paid_at is null
          )
        )
      )
  )
);

create or replace function private.enqueue_order_status_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_email text := new.customer_snapshot ->> 'email';
  v_has_rejected_custom boolean := false;
  v_is_confirmed_payment boolean := new.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );
begin
  -- A PayPal row is only a private checkout session until the capture RPC sets
  -- paid_at. No customer/admin email may be created before that point.
  if new.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
     and new.paid_at is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.shipping_method = 'international_coordination' then
      perform private.enqueue_commerce_email(new.id, 'customer_international_received', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
      return new;
    end if;

    if v_is_confirmed_payment then
      perform private.enqueue_commerce_email(new.id, 'customer_order_received', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
      perform private.enqueue_commerce_email(new.id, 'customer_payment_confirmed', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_payment_confirmed', 'admin');
      if new.status = 'paid_pending_review' then
        perform private.enqueue_commerce_email(new.id, 'admin_custom_review_required', 'admin');
      elsif new.status = 'manual_review' then
        perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
      end if;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending_payment' and v_is_confirmed_payment then
    perform private.enqueue_commerce_email(new.id, 'customer_order_received', 'customer', v_customer_email);
    perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
  end if;

  if new.status in ('paid_pending_review', 'ready_for_fulfillment') then
    perform private.enqueue_commerce_email(new.id, 'customer_payment_confirmed', 'customer', v_customer_email);
    perform private.enqueue_commerce_email(new.id, 'admin_payment_confirmed', 'admin');
  end if;

  if new.status = 'paid_pending_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_custom_review_required', 'admin');
  elsif new.status = 'ready_for_production' then
    perform private.enqueue_commerce_email(new.id, 'customer_custom_approved', 'customer', v_customer_email);
  elsif new.status = 'manual_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
  elsif new.status = 'refunded' then
    select exists (
      select 1
      from public.order_items
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

create or replace function public.discard_unconfirmed_paypal_order(p_paypal_order_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  select order_row.id into v_order_id
  from public.orders order_row
  where order_row.paypal_order_id = p_paypal_order_id
    and order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
    and order_row.paid_at is null
    and not exists (
      select 1
      from public.commerce_payments payment
      where payment.order_id = order_row.id and payment.status = 'approved'
    )
  for update;

  if v_order_id is null then return false; end if;

  delete from public.commerce_payments where order_id = v_order_id;
  delete from public.order_items where order_id = v_order_id;
  delete from public.orders where id = v_order_id;
  return true;
end;
$$;

revoke all on function public.discard_unconfirmed_paypal_order(text) from public, anon, authenticated;
grant execute on function public.discard_unconfirmed_paypal_order(text) to service_role;

create or replace function public.expire_pending_commerce_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with doomed as (
    select order_row.id
    from public.orders order_row
    where (
      (order_row.status = 'pending_payment' and order_row.reservation_expires_at < now())
      or (
        order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
        and order_row.status in ('payment_failed', 'cancelled')
      )
    )
      and not exists (
        select 1 from public.commerce_payments payment
        where payment.order_id = order_row.id and payment.status = 'approved'
      )
    for update
  ), deleted_payments as (
    delete from public.commerce_payments payment
    using doomed
    where payment.order_id = doomed.id
  ), deleted_items as (
    delete from public.order_items item
    using doomed
    where item.order_id = doomed.id
  ), deleted_orders as (
    delete from public.orders order_row
    using doomed
    where order_row.id = doomed.id
    returning order_row.id
  )
  select count(*) into v_count from deleted_orders;

  return v_count;
end;
$$;

revoke all on function public.expire_pending_commerce_orders() from public, anon, authenticated;
grant execute on function public.expire_pending_commerce_orders() to service_role;

-- Run cleanup regularly. cron.schedule is used instead of direct cron.job
-- writes, which Supabase no longer permits.
select cron.schedule(
  'expire-unconfirmed-commerce-orders',
  '*/15 * * * *',
  'select public.expire_pending_commerce_orders()'
)
where not exists (
  select 1 from cron.job where jobname = 'expire-unconfirmed-commerce-orders'
);

-- Remove all historical PayPal attempts that never produced an approved payment.
create temporary table doomed_unconfirmed_paypal_orders on commit drop as
select order_row.id
from public.orders order_row
where order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
  and order_row.paid_at is null
  and order_row.status in ('pending_payment', 'payment_failed', 'cancelled')
  and not exists (
    select 1
    from public.commerce_payments payment
    where payment.order_id = order_row.id and payment.status = 'approved'
  );

delete from public.commerce_payments payment
using doomed_unconfirmed_paypal_orders doomed
where payment.order_id = doomed.id;

delete from public.order_items item
using doomed_unconfirmed_paypal_orders doomed
where item.order_id = doomed.id;

delete from public.orders order_row
using doomed_unconfirmed_paypal_orders doomed
where order_row.id = doomed.id;
