-- Pickup has its own completed state; shipping continues to require tracking.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending_payment', 'payment_verification_pending', 'paid_pending_review',
  'ready_for_fulfillment', 'ready_for_production', 'shipped', 'delivered',
  'payment_failed', 'cancelled', 'refunded', 'manual_review',
  'internal_open', 'internal_completed'
));

alter table public.orders
  add column delivered_at timestamptz,
  add constraint orders_pickup_delivered_check check (
    status <> 'delivered' or (shipping_method = 'pickup' and delivered_at is not null)
  );

-- Keep the existing refund safeguard for the new fulfilled state.
create or replace function private.guard_commerce_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('ready_for_production', 'ready_for_fulfillment', 'shipped', 'delivered')
     and exists(select 1 from private.commerce_refund_attempts where order_id = new.id) then
    raise exception 'El pedido tiene un reembolso registrado';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_commerce_refund() from public, anon, authenticated;

-- A fulfilled order is finished in production even if the workshop did not
-- update each line beforehand. This runs in the same transaction as fulfillment.
create or replace function private.finish_order_items_on_fulfillment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('shipped', 'delivered') and new.status is distinct from old.status then
    update public.order_items
       set production_status = 'completed',
           completed_at = coalesce(completed_at, now())
     where order_id = new.id
       and production_status is distinct from 'completed';
  end if;
  return new;
end;
$$;

revoke all on function private.finish_order_items_on_fulfillment() from public, anon, authenticated;

create trigger orders_finish_items_on_fulfillment
after update of status on public.orders
for each row execute function private.finish_order_items_on_fulfillment();

-- Align previously shipped orders with the production board.
update public.order_items as item
   set production_status = 'completed',
       completed_at = coalesce(item.completed_at, orders.shipped_at, now())
  from public.orders as orders
 where item.order_id = orders.id
   and orders.status = 'shipped'
   and item.production_status is distinct from 'completed';
