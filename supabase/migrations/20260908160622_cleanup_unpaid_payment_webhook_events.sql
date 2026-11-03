-- Legacy payment attempts used to persist their webhook event even when the
-- payment never completed. Approved payments always retain a matching row in
-- commerce_payments, while the new processor does not insert ignored events.
delete from public.payment_webhook_events event
where event.signature_valid
  and event.event_type like 'payment.%'
  and nullif(event.payload -> 'data' ->> 'id', '') is not null
  and not exists (
    select 1
    from public.commerce_payments payment
    where payment.provider_payment_id = event.payload -> 'data' ->> 'id'
  );
