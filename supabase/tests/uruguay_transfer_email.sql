-- Run after uruguay_transfer_email_fixture.sql and the customer-payment-email migration.
begin;
create trigger test_order_status_emails after insert or update on public.orders
for each row execute function private.enqueue_order_status_emails();
do $$
declare
  a uuid := gen_random_uuid(); o uuid; flow text; custom boolean; n integer;
begin
  insert into public.commerce_admin_users values(a,true);
  foreach custom in array array[false,true] loop
    insert into public.orders(status,total_minor,customer_snapshot)
    values('payment_verification_pending',656100,'{"email":"test@example.invalid","purchaseFlow":"uruguay_retail_transfer"}') returning id into o;
    insert into public.order_items(order_id,requires_review) values(o,custom);
    insert into public.commerce_bank_transfer_receipts(order_id) values(o);
    if (select count(*) from public.commerce_email_outbox where order_id=o) <> 1 or
      not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='admin_payment_review_required') then
      raise exception 'Pending review notice missing'; end if;
    if not exists(select 1 from public.test_email_dispatch where order_id=o and event_type='admin_payment_review_required') then
      raise exception 'Pending review notice was not dispatched'; end if;
    perform public.review_wholesale_bank_transfer_order(a,o,'approve');
    if not exists(select 1 from public.orders where id=o and paid_at is not null
      and status=case when custom then 'paid_pending_review' else 'ready_for_fulfillment' end) then raise exception 'Wrong payment status'; end if;
    if (select count(*) from public.commerce_email_outbox where order_id=o) <> 2 then raise exception 'Expected customer and team notices'; end if;
    if not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_payment_confirmed'
      and recipient_kind='customer' and recipient_email='test@example.invalid') then raise exception 'Customer confirmation missing'; end if;
    if exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_order_received') then raise exception 'Duplicate received notice'; end if;
    if not exists(select 1 from public.test_email_dispatch where order_id=o and event_type='customer_payment_confirmed') then raise exception 'No immediate dispatch'; end if;
    begin
      perform public.review_wholesale_bank_transfer_order(a,o,'approve');
      raise exception 'TEST FAILED: repeated approval accepted';
    exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
    perform private.enqueue_commerce_email(o,'customer_payment_confirmed','customer','test@example.invalid');
    if (select count(*) from public.commerce_email_outbox where order_id=o) <> 2 then raise exception 'Duplicate confirmation'; end if;
    select count(*) into n from public.claim_commerce_email_jobs(o,20);
    if n<>2 then raise exception 'Worker cannot claim new event'; end if;
    select count(*) into n from public.claim_commerce_email_jobs(o,20);
    if n<>0 then raise exception 'Worker claimed same emails twice'; end if;
  end loop;

  -- Argentina starts pending payment and requests review only after receipt upload.
  insert into public.orders(status,total_minor,customer_snapshot)
  values('pending_payment',1000,'{"email":"test@example.invalid","purchaseFlow":"argentina_retail_transfer"}') returning id into o;
  if exists(select 1 from public.commerce_email_outbox where order_id=o) then raise exception 'Argentina notice before receipt'; end if;
  update public.orders set status='payment_verification_pending' where id=o;
  if (select count(*) from public.commerce_email_outbox where order_id=o and event_type='admin_payment_review_required') <> 1 then
    raise exception 'Argentina pending notice missing'; end if;
  update public.orders set total_minor=1100 where id=o;
  if (select count(*) from public.commerce_email_outbox where order_id=o and event_type='admin_payment_review_required') <> 1 then
    raise exception 'Argentina pending notice duplicated'; end if;
  update public.orders set status='ready_for_fulfillment',paid_at=now() where id=o;
  if not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_payment_confirmed')
    or exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_order_received') then
    raise exception 'Argentina transfer routed to wrong customer email'; end if;

  -- Review notice is queued for each transfer; only approval confirms payment.
  foreach flow in array array['uruguay_retail_transfer','wholesale_bank_transfer'] loop
    insert into public.orders(status,total_minor,customer_snapshot)
    values('payment_verification_pending',1000,jsonb_build_object('email','test@example.invalid','purchaseFlow',flow)) returning id into o;
    insert into public.commerce_bank_transfer_receipts(order_id) values(o);
    if not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='admin_payment_review_required') then
      raise exception 'Pending transfer notice missing'; end if;
    perform public.review_wholesale_bank_transfer_order(a,o,case when flow='uruguay_retail_transfer' then 'reject' else 'approve' end,'Comprobante incorrecto');
    if flow='uruguay_retail_transfer' and exists(select 1 from public.commerce_email_outbox where order_id=o) then
      raise exception 'Unexpected confirmation after rejection'; end if;
    if flow='wholesale_bank_transfer' and (
      not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_payment_confirmed')
      or exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_order_received')
    ) then raise exception 'Wholesale transfer routed to wrong customer email'; end if;
  end loop;

  -- Existing online payments still send their original receipt and admin notice.
  insert into public.orders(status,total_minor,customer_snapshot)
  values('ready_for_fulfillment',1000,'{"email":"test@example.invalid"}') returning id into o;
  if not exists(select 1 from public.commerce_email_outbox where order_id=o and event_type='customer_order_received') then raise exception 'Online receipt regressed'; end if;
  insert into public.orders(channel,status,total_minor,customer_snapshot)
  values('Local','ready_for_fulfillment',1000,'{"email":"test@example.invalid"}') returning id into o;
  if exists(select 1 from public.commerce_email_outbox where order_id=o) then raise exception 'Email from local sale'; end if;
end $$;
rollback;
