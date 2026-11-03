alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check check (status in (
    'pending_payment', 'paid_pending_review', 'ready_for_fulfillment',
    'ready_for_production', 'shipped', 'payment_failed', 'cancelled',
    'refunded', 'manual_review'
  ));

alter table public.orders
  add column shipping_carrier text,
  add column tracking_code text,
  add column shipped_at timestamptz,
  add constraint orders_shipping_carrier_length_check
    check (shipping_carrier is null or char_length(shipping_carrier) between 2 and 120),
  add constraint orders_tracking_code_length_check
    check (tracking_code is null or char_length(tracking_code) between 3 and 160),
  add constraint orders_shipped_details_check
    check (
      status <> 'shipped'
      or (
        shipping_method <> 'pickup'
        and nullif(btrim(shipping_carrier), '') is not null
        and nullif(btrim(tracking_code), '') is not null
        and shipped_at is not null
      )
    );

comment on column public.orders.shipping_carrier is
  'Carrier entered by a commerce administrator when the order is dispatched.';
comment on column public.orders.tracking_code is
  'Carrier tracking identifier entered when the order is dispatched.';
comment on column public.orders.shipped_at is
  'Timestamp of the latest transition to the shipped status.';

create or replace function private.enqueue_shipped_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger orders_enqueue_shipped_email
after update of status on public.orders
for each row execute function private.enqueue_shipped_order_email();
