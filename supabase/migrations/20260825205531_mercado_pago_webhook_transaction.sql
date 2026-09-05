create or replace function public.process_mercado_pago_payment(
  p_event_id text,
  p_event_type text,
  p_event_payload jsonb,
  p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order public.orders%rowtype;
  v_existing_payment public.commerce_payments%rowtype;
  v_payment_id text := p_payment ->> 'id';
  v_order_id uuid;
  v_status text := coalesce(p_payment ->> 'status', 'unknown');
  v_status_detail text := p_payment ->> 'status_detail';
  v_currency text := coalesce(p_payment ->> 'currency_id', '');
  v_amount_minor bigint := round(coalesce((p_payment ->> 'transaction_amount')::numeric, 0) * 100);
  v_target_status text;
  v_has_custom boolean;
begin
  if p_event_id is null or p_event_id = '' or v_payment_id is null then raise exception 'Evento de pago incompleto'; end if;
  begin
    insert into public.payment_webhook_events (provider_event_id, event_type, signature_valid, payload)
    values (p_event_id, p_event_type, true, p_event_payload)
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true);
  end;

  begin
    v_order_id := (p_payment ->> 'external_reference')::uuid;
  exception when others then
    update public.payment_webhook_events set processed_at = now(), processing_error = 'external_reference inválida' where id = v_event_id;
    return jsonb_build_object('processed', false, 'reason', 'invalid_reference');
  end;

  select * into v_order from public.orders where id = v_order_id for update;
  if not found then
    update public.payment_webhook_events set processed_at = now(), processing_error = 'pedido inexistente' where id = v_event_id;
    return jsonb_build_object('processed', false, 'reason', 'order_not_found');
  end if;

  select * into v_existing_payment from public.commerce_payments where provider_payment_id = v_payment_id for update;
  insert into public.commerce_payments (order_id, provider_payment_id, status, status_detail, amount_minor, currency, raw_payload, approved_at)
  values (v_order.id, v_payment_id, v_status, v_status_detail, v_amount_minor, case when v_currency = 'UYU' then 'UYU' else 'UYU' end, p_payment,
          case when v_status = 'approved' then coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now()) else null end)
  on conflict (provider_payment_id) do update set
    status = case when public.commerce_payments.status = 'approved' and excluded.status not in ('refunded', 'charged_back') then public.commerce_payments.status else excluded.status end,
    status_detail = excluded.status_detail,
    amount_minor = excluded.amount_minor,
    raw_payload = excluded.raw_payload,
    approved_at = coalesce(public.commerce_payments.approved_at, excluded.approved_at),
    updated_at = now();

  if v_currency <> 'UYU' or v_amount_minor <> v_order.total_minor then
    update public.orders set status = 'manual_review' where id = v_order.id;
    update public.payment_webhook_events set processed_at = now(), processing_error = 'monto o moneda no coincide' where id = v_event_id;
    return jsonb_build_object('processed', true, 'manualReview', true, 'reason', 'amount_mismatch');
  end if;

  if v_status = 'approved' then
    if v_order.status in ('paid_pending_review', 'ready_for_fulfillment', 'ready_for_production') then
      null;
    elsif v_order.status <> 'pending_payment' or v_order.reservation_expires_at < now() then
      update public.orders set status = 'manual_review', paid_at = coalesce(paid_at, now()) where id = v_order.id;
    else
      select exists (select 1 from public.order_items where order_id = v_order.id and requires_review) into v_has_custom;
      v_target_status := case when v_has_custom then 'paid_pending_review' else 'ready_for_fulfillment' end;
      update public.orders set status = v_target_status, paid_at = coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now()) where id = v_order.id;
    end if;
  elsif v_status in ('rejected', 'cancelled') and v_order.status = 'pending_payment' then
    update public.orders set status = 'payment_failed', cancelled_at = now() where id = v_order.id;
  elsif v_status in ('refunded', 'charged_back') then
    update public.orders set status = 'refunded' where id = v_order.id;
  end if;

  update public.payment_webhook_events set processed_at = now() where id = v_event_id;
  return jsonb_build_object('processed', true, 'orderId', v_order.id, 'paymentStatus', v_status);
end;
$$;

revoke all on function public.process_mercado_pago_payment(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.process_mercado_pago_payment(text, text, jsonb, jsonb) to service_role;

comment on function public.process_mercado_pago_payment(text, text, jsonb, jsonb)
is 'Idempotently persists a verified Mercado Pago payment and advances the order in one transaction.';
