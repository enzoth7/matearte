-- Service-only payment orchestration. Applied before the new web handlers.
CREATE OR REPLACE FUNCTION public.create_paypal_international_order(p_user_id uuid, p_cart_id uuid, p_design_prices jsonb, p_customer_snapshot jsonb, p_destination_snapshot jsonb, p_idempotency_key uuid, p_shipping_minor bigint, p_peso integer, p_discount_code text, p_usd_rate numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_base jsonb;
  v_order public.orders%rowtype;
  v_discount jsonb;
  v_discount_minor bigint := 0;
  v_design_subtotal_minor bigint := 0;
  v_amount_usd_minor bigint;
begin
  if p_usd_rate is null or p_usd_rate <= 0 then raise exception 'Cotización USD inválida'; end if;

  v_base := public.create_paypal_international_order(
    p_user_id, p_cart_id, p_design_prices, p_customer_snapshot,
    p_destination_snapshot, p_idempotency_key, 0, p_shipping_minor, p_peso
  );

  select * into v_order
  from public.orders
  where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key
  for update;
  if not found then raise exception 'No se pudo crear la orden de PayPal'; end if;

  -- Once sent to PayPal (or closed), retries must preserve the historical quote.
  if v_order.paypal_order_id is not null or v_order.paid_at is not null or v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
      'itemsSubtotalMinor',v_order.items_subtotal_minor,'shippingMinor',v_order.shipping_minor,
      'discountMinor',v_order.discount_minor,'totalMinor',v_order.total_minor,
      'paypalAmountUsdMinor',v_order.paypal_amount_usd_minor,'existing',true);
  end if;

  select coalesce(sum(item.total_minor), 0)::bigint into v_design_subtotal_minor
  from public.order_items item
  where item.order_id = v_order.id and item.item_type = 'design';

  if nullif(btrim(coalesce(p_discount_code, '')), '') is not null then
    if v_order.discount_minor > 0 then
      if v_order.discount_code <> upper(btrim(p_discount_code)) then
        raise exception 'El reintento debe conservar el código de descuento';
      end if;
      v_discount_minor := v_order.discount_minor;
    else
      if v_order.paypal_order_id is not null then
        raise exception 'La orden de PayPal ya fue creada y no admite otro descuento';
      end if;
      v_discount := public.reserve_commerce_discount(
        p_user_id,
        p_discount_code,
        v_order.items_subtotal_minor,
        v_design_subtotal_minor,
        p_idempotency_key,
        coalesce(v_order.reservation_expires_at, now() + interval '2 hours')
      );
      v_discount_minor := (v_discount ->> 'discountMinor')::bigint;
      update public.orders set
        discount_id = (v_discount ->> 'discountId')::uuid,
        discount_code = v_discount ->> 'code',
        discount_type = v_discount ->> 'discountType',
        discount_value = (v_discount ->> 'discountValue')::numeric,
        discount_minor = v_discount_minor,
        total_minor = items_subtotal_minor + shipping_minor + payment_fee_minor - v_discount_minor
      where id = v_order.id
      returning * into v_order;
      update public.commerce_discount_usages set order_id = v_order.id
      where checkout_key = p_idempotency_key and user_id = p_user_id;
    end if;
  elsif v_order.discount_minor > 0 then
    raise exception 'El reintento debe conservar el código de descuento';
  end if;

  v_amount_usd_minor := round(v_order.total_minor::numeric / p_usd_rate)::bigint;
  update public.orders set paypal_amount_usd_minor = v_amount_usd_minor where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'shippingMinor', v_order.shipping_minor,
    'discountMinor', v_order.discount_minor,
    'totalMinor', v_order.total_minor,
    'paypalAmountUsdMinor', v_amount_usd_minor,
    'existing', coalesce((v_base ->> 'existing')::boolean, false)
  );
end;
$function$;
create table private.commerce_refund_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  payment_id uuid not null references public.commerce_payments(id),
  provider text not null,
  provider_payment_id text not null,
  status text not null default 'pending' check (status in ('pending','completed','manual')),
  reason text not null,
  requested_by uuid not null references auth.users(id),
  provider_refund_id text,
  provider_response jsonb,
  created_at timestamptz not null default now()
);
alter table private.commerce_refund_attempts enable row level security;
revoke all on private.commerce_refund_attempts from public, anon, authenticated;
grant all on private.commerce_refund_attempts to service_role;

create table private.commerce_paypal_refunds (
  refund_id text primary key,
  payment_id uuid not null references public.commerce_payments(id),
  amount_minor bigint not null check (amount_minor > 0),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.commerce_paypal_refunds enable row level security;
revoke all on private.commerce_paypal_refunds from public, anon, authenticated;
grant all on private.commerce_paypal_refunds to service_role;

CREATE OR REPLACE FUNCTION public.expire_pending_commerce_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and order_row.paypal_order_id is null
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

  -- Keep provider correlation after a reservation expires; late money needs review.
  update public.orders set status = 'cancelled'
  where paypal_order_id is not null and paid_at is null
    and status = 'pending_payment' and reservation_expires_at < now();
  return v_count;
end;
$function$;


create or replace function public.discard_unconfirmed_paypal_order(p_paypal_order_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.orders o set status='cancelled'
  where o.paypal_order_id=p_paypal_order_id and o.paid_at is null
    and o.status='pending_payment'
    and not exists (select 1 from public.commerce_payments p where p.order_id=o.id and p.status='approved');
  return found;
end;
$$;

create or replace function public.process_paypal_payment(
 p_event_id text, p_event_type text, p_paypal_order_id text, p_capture_id text,
 p_amount_usd_minor bigint, p_capture_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_order public.orders%rowtype;
 v_payment public.commerce_payments%rowtype;
 v_event uuid;
 v_late boolean;
 v_manual boolean;
 v_currency text;
begin
 v_currency := coalesce(p_capture_payload #>> '{resource,amount,currency_code}',
   p_capture_payload #>> '{purchase_units,0,payments,captures,0,amount,currency_code}');
 if coalesce(trim(p_event_id),'')='' or coalesce(trim(p_capture_id),'')=''
   or p_event_type <> 'PAYMENT.CAPTURE.COMPLETED'
   or p_amount_usd_minor is null or p_amount_usd_minor <= 0 or v_currency is distinct from 'USD' then
   raise exception 'Evento PayPal inválido';
 end if;
 select * into v_order from public.orders where paypal_order_id=p_paypal_order_id for update;
 if not found then raise exception 'Orden de PayPal no encontrada'; end if;
 insert into public.payment_webhook_events(provider,provider_event_id,event_type,signature_valid,payload)
 values('paypal',p_event_id,p_event_type,true,p_capture_payload)
 on conflict(provider,provider_event_id) do nothing returning id into v_event;
 if v_event is null then return jsonb_build_object('duplicate',true,'orderId',v_order.id,'manualReview',v_order.status='manual_review'); end if;

 select * into v_payment from public.commerce_payments where provider_payment_id=p_capture_id;
 if found then
   if v_payment.order_id <> v_order.id or v_payment.provider <> 'paypal'
      or v_payment.amount_minor <> p_amount_usd_minor or v_payment.currency <> 'USD' then
     raise exception 'Captura PayPal incompatible con el pago registrado';
   end if;
   -- Never turn a refunded payment back into an approved payment on a replay.
   update public.payment_webhook_events set processed_at=now() where id=v_event;
   return jsonb_build_object('duplicate',true,'orderId',v_order.id,'manualReview',v_order.status='manual_review');
 end if;

 v_late := v_order.status <> 'pending_payment' or v_order.reservation_expires_at < now();
 v_manual := coalesce(v_late,false) or v_order.paypal_amount_usd_minor is null
             or p_amount_usd_minor <> v_order.paypal_amount_usd_minor;
 insert into public.commerce_payments(order_id,provider,provider_payment_id,status,status_detail,amount_minor,currency,raw_payload,approved_at)
 values(v_order.id,'paypal',p_capture_id,'approved',
   case when v_manual then 'requires_reconciliation' end,p_amount_usd_minor,'USD',p_capture_payload,now());
 update public.orders set
   paid_at=coalesce(paid_at,now()),
   status=case when v_manual then 'manual_review'
     when exists(select 1 from public.order_items where order_id=v_order.id and requires_review) then 'paid_pending_review'
     else 'ready_for_fulfillment' end
 where id=v_order.id;
 update public.carts set status='converted' where id=v_order.cart_id;
 if not v_manual and v_order.discount_minor > 0 then
   perform private.redeem_commerce_discount(v_order.user_id,v_order.checkout_idempotency_key,v_order.id);
 end if;
 update public.payment_webhook_events set processed_at=now(),
   processing_error=case when v_manual then 'Requiere conciliación de importe o pago tardío' end where id=v_event;
 return jsonb_build_object('processed',true,'orderId',v_order.id,'paymentStatus','approved','manualReview',v_manual);
end;
$$;

create or replace function public.begin_commerce_order_review(p_order_id uuid,p_decision text,p_reason text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_order public.orders%rowtype;
 v_payment public.commerce_payments%rowtype;
 v_attempt private.commerce_refund_attempts%rowtype;
begin
 if not exists(select 1 from public.commerce_admin_users where user_id=p_actor and active) then raise exception 'Sin autorización'; end if;
 if p_decision not in ('approve','reject') or p_decision is null then raise exception 'Decisión inválida'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido no encontrado'; end if;
 select * into v_attempt from private.commerce_refund_attempts where order_id=p_order_id;
 if found then
   if p_decision <> 'reject' then raise exception 'Hay un reembolso en curso'; end if;
   if exists(select 1 from public.commerce_payments where id=v_attempt.payment_id and status='refunded') then
     update private.commerce_refund_attempts set status='completed' where id=v_attempt.id returning * into v_attempt;
   end if;
   return to_jsonb(v_attempt) || jsonb_build_object('dispatch',false);
 end if;
 if v_order.status <> 'paid_pending_review' then raise exception 'El pedido no está pendiente de revisión'; end if;
 if p_decision='approve' then
   update public.order_items set review_status='approved',review_reason=null where order_id=p_order_id and requires_review;
   update public.orders set status='ready_for_production' where id=p_order_id;
   return jsonb_build_object('status','approved','dispatch',false);
 end if;
 if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Indicá el motivo del rechazo'; end if;
 -- A split/duplicate collection must be reconciled, never arbitrarily refund one payment.
 if (select count(*) from public.commerce_payments where order_id=p_order_id and status='approved') <> 1 then
   raise exception 'El pedido requiere conciliar sus pagos antes del reembolso';
 end if;
 select * into v_payment from public.commerce_payments where order_id=p_order_id and status='approved';
 insert into private.commerce_refund_attempts(order_id,payment_id,provider,provider_payment_id,reason,requested_by,status)
 values(p_order_id,v_payment.id,v_payment.provider,v_payment.provider_payment_id,left(trim(p_reason),500),p_actor,
   case when v_payment.provider='bank_transfer' then 'manual' else 'pending' end) returning * into v_attempt;
 update public.order_items set review_status='rejected',review_reason=left(trim(p_reason),500) where order_id=p_order_id and requires_review;
 update public.orders set status='manual_review' where id=p_order_id;
 return to_jsonb(v_attempt) || jsonb_build_object('dispatch',v_payment.provider in ('paypal','mercado_pago'));
end;
$$;

create or replace function public.finish_commerce_refund(p_attempt_id uuid,p_completed boolean,p_provider_refund_id text,p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attempt private.commerce_refund_attempts%rowtype; v_order_id uuid;
begin
 select order_id into v_order_id from private.commerce_refund_attempts where id=p_attempt_id;
 if not found then raise exception 'Reembolso no encontrado'; end if;
 perform 1 from public.orders where id=v_order_id for update;
 select * into v_attempt from private.commerce_refund_attempts where id=p_attempt_id for update;
 update private.commerce_refund_attempts set
   status=case when p_completed or status='completed' then 'completed' else status end,
   provider_refund_id=coalesce(p_provider_refund_id,provider_refund_id),provider_response=p_response where id=p_attempt_id;
 if p_completed then
   update public.commerce_payments set status='refunded' where id=v_attempt.payment_id;
   update public.orders set status='refunded' where id=v_attempt.order_id;
 end if;
 return jsonb_build_object('status',case when p_completed or v_attempt.status='completed' then 'completed' else v_attempt.status end);
end;
$$;

create or replace function public.process_paypal_refund(p_event_id text,p_capture_id text,p_refund_id text,p_amount_usd_minor bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payment public.commerce_payments%rowtype; v_order_id uuid; v_total bigint;
begin
 if coalesce(p_refund_id,'')='' or p_amount_usd_minor is null or p_amount_usd_minor <= 0
    or p_payload #>> '{resource,amount,currency_code}' is distinct from 'USD'
    or p_payload #>> '{resource,status}' is distinct from 'COMPLETED' then raise exception 'Reembolso PayPal inválido'; end if;
 select order_id into v_order_id from public.commerce_payments where provider='paypal' and provider_payment_id=p_capture_id;
 if not found then raise exception 'Captura pendiente de conciliación'; end if;
 perform 1 from public.orders where id=v_order_id for update;
 select * into v_payment from public.commerce_payments where provider='paypal' and provider_payment_id=p_capture_id;
 if exists(select 1 from private.commerce_paypal_refunds where refund_id=p_refund_id and (payment_id<>v_payment.id or amount_minor<>p_amount_usd_minor)) then
   raise exception 'Reembolso incompatible';
 end if;
 insert into private.commerce_paypal_refunds(refund_id,payment_id,amount_minor,payload)
 values(p_refund_id,v_payment.id,p_amount_usd_minor,p_payload) on conflict(refund_id) do nothing;
 select sum(amount_minor) into v_total from private.commerce_paypal_refunds where payment_id=v_payment.id;
 if v_total >= v_payment.amount_minor then
   update public.commerce_payments set status='refunded' where id=v_payment.id;
   update private.commerce_refund_attempts set status='completed',provider_refund_id=p_refund_id where payment_id=v_payment.id;
 end if;
 update public.orders set status=case when v_total >= v_payment.amount_minor
   and not exists(select 1 from public.commerce_payments where order_id=v_order_id and status='approved')
   then 'refunded' else 'manual_review' end where id=v_order_id;
 insert into public.payment_webhook_events(provider,provider_event_id,event_type,signature_valid,payload,processed_at)
 values('paypal',p_event_id,'PAYMENT.CAPTURE.REFUNDED',true,p_payload,now()) on conflict(provider,provider_event_id) do nothing;
 return jsonb_build_object('orderId',v_order_id,'refunded',v_total >= v_payment.amount_minor);
end;
$$;

-- Protect production from older clients approving a rejected order during a refund.
create or replace function private.guard_commerce_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.status in ('ready_for_production','ready_for_fulfillment','shipped')
    and exists(select 1 from private.commerce_refund_attempts where order_id=new.id) then
   raise exception 'El pedido tiene un reembolso registrado';
 end if;
 return new;
end;
$$;
create trigger guard_commerce_refund before update of status on public.orders
for each row execute function private.guard_commerce_refund();

revoke all on function public.begin_commerce_order_review(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_commerce_refund(uuid,boolean,text,jsonb) from public,anon,authenticated;
revoke all on function public.process_paypal_refund(text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.begin_commerce_order_review(uuid,text,text,uuid) to service_role;
grant execute on function public.finish_commerce_refund(uuid,boolean,text,jsonb) to service_role;
grant execute on function public.process_paypal_refund(text,text,text,bigint,jsonb) to service_role;
revoke all on function public.process_paypal_payment(text,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.process_paypal_payment(text,text,text,text,bigint,jsonb) to service_role;
revoke all on function public.discard_unconfirmed_paypal_order(text) from public,anon,authenticated;
revoke all on function public.expire_pending_commerce_orders() from public,anon,authenticated;
grant execute on function public.discard_unconfirmed_paypal_order(text) to service_role;
grant execute on function public.expire_pending_commerce_orders() to service_role;
revoke all on function private.guard_commerce_refund() from public,anon,authenticated;
