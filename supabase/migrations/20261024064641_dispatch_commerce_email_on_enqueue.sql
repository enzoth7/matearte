-- pg_net starts the request only after the order transaction commits, so the
-- worker can see the complete order and its newly queued email.
create or replace function private.dispatch_commerce_email_on_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://agdkljuulwjwjasftcce.supabase.co/functions/v1/commerce-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'matearte_lifecycle_service_role')
    ),
    body := jsonb_build_object('orderId', new.order_id),
    timeout_milliseconds := 30000
  );
  return new;
end;
$$;

revoke all on function private.dispatch_commerce_email_on_enqueue() from public, anon, authenticated;

create trigger commerce_email_outbox_dispatch
after insert on public.commerce_email_outbox
for each row
when (new.event_type in (
  'customer_order_received',
  'customer_custom_approved',
  'customer_order_ready',
  'customer_order_shipped',
  'admin_payment_confirmed'
))
execute function private.dispatch_commerce_email_on_enqueue();
