-- Send the same order notifications for web and manually registered sales.
-- Manual sales keep the contact email in local_sales_customers, not in the order snapshot.
create or replace function private.enqueue_shipped_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_email text;
begin
  if new.status <> 'shipped' or new.status is not distinct from old.status
     or new.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then
    return new;
  end if;

  recipient_email := nullif(btrim(new.customer_snapshot ->> 'email'), '');
  if recipient_email is null and new.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook') then
    select nullif(btrim(customer.email), '') into recipient_email
      from public.local_sales_customers customer
     where customer.id::text = new.customer_snapshot ->> 'localCustomerId';
  end if;
  if recipient_email is null then return new; end if;

  if new.shipping_method = 'pickup' then
    perform private.enqueue_commerce_email(new.id, 'customer_order_ready', 'customer', recipient_email, '{}'::jsonb);
  else
    perform private.enqueue_commerce_email(
      new.id,
      'customer_order_shipped',
      'customer',
      recipient_email,
      jsonb_build_object('shippingCarrier', new.shipping_carrier, 'trackingCode', new.tracking_code)
    );
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_shipped_order_email() from public, anon, authenticated;
