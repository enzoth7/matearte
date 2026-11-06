-- A prepared pickup may be marked as sent before the customer collects it.
-- Manual sales can be dispatched before carrier and tracking are known.
alter table public.orders drop constraint if exists orders_shipped_details_check;
alter table public.orders add constraint orders_shipped_details_check check (
  status <> 'shipped' or (
    shipped_at is not null and (
      shipping_method = 'pickup' or channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook') or (
        nullif(btrim(shipping_carrier), '') is not null
        and nullif(btrim(tracking_code), '') is not null
      )
    )
  )
);

-- A pickup is not a dispatched parcel, so it must not receive tracking email.
create or replace function private.enqueue_shipped_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.channel, '') not in ('Web', 'Mayorista web')
     or new.shipping_method = 'pickup'
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
