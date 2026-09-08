-- Domestic Checkout Pro attempts are no longer orders. A durable order, payment,
-- webhook event and email jobs are created only after Mercado Pago reports an
-- approved payment. Domestic delivery is recorded without a shipping charge;
-- the customer pays shipping when the order arrives.

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
  if tg_op = 'INSERT' then
    if new.shipping_method = 'international_coordination' then
      perform private.enqueue_commerce_email(new.id, 'customer_international_received', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
      return new;
    end if;

    -- A domestic row can be inserted directly in its post-payment state by the
    -- webhook transaction. Pending/failed attempts intentionally enqueue nothing.
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

  -- Compatibility for an already-created legacy pending order that is approved
  -- after this migration is deployed.
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
  v_cart public.carts%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_payment_id text := p_payment ->> 'id';
  v_reference uuid;
  v_status text := coalesce(p_payment ->> 'status', 'unknown');
  v_status_detail text := p_payment ->> 'status_detail';
  v_currency text := coalesce(p_payment ->> 'currency_id', '');
  v_amount_minor bigint := round(coalesce((p_payment ->> 'transaction_amount')::numeric, 0) * 100);
  v_checkout jsonb;
  v_items jsonb;
  v_customer jsonb;
  v_user_id uuid;
  v_cart_id uuid;
  v_shipping_rate_id uuid;
  v_items_subtotal bigint;
  v_fee_minor bigint;
  v_expected_total bigint;
  v_has_custom boolean;
  v_target_status text;
  v_item_count integer;
  v_catalog_count integer;
  v_design_count integer;
begin
  -- Pending, rejected and cancelled attempts leave no local event, payment,
  -- order, order item or email job. A later approved update is still processed.
  if v_status not in ('approved', 'refunded', 'charged_back') then
    return jsonb_build_object('processed', false, 'ignored', true, 'paymentStatus', v_status);
  end if;

  if p_event_id is null or p_event_id = '' or v_payment_id is null then
    raise exception 'Evento de pago incompleto';
  end if;

  begin
    v_reference := (p_payment ->> 'external_reference')::uuid;
  exception when others then
    return jsonb_build_object('processed', false, 'reason', 'invalid_reference');
  end;

  select * into v_order
  from public.orders
  where id = v_reference or checkout_idempotency_key = v_reference
  order by (id = v_reference) desc
  limit 1
  for update;

  -- A refund/chargeback only has meaning for an already-approved payment.
  if not found and v_status <> 'approved' then
    return jsonb_build_object('processed', false, 'ignored', true, 'reason', 'order_not_found');
  end if;

  begin
    insert into public.payment_webhook_events (provider_event_id, event_type, signature_valid, payload)
    values (p_event_id, p_event_type, true, p_event_payload)
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true);
  end;

  if v_order.id is null then
    begin
      v_checkout := case
        when jsonb_typeof(p_payment -> 'metadata' -> 'checkout_payload') = 'string'
          then (p_payment -> 'metadata' ->> 'checkout_payload')::jsonb
        when jsonb_typeof(p_payment -> 'metadata' -> 'checkout_payload') = 'object'
          then p_payment -> 'metadata' -> 'checkout_payload'
        else null
      end;
      v_user_id := (v_checkout ->> 'userId')::uuid;
      v_cart_id := (v_checkout ->> 'cartId')::uuid;
      v_shipping_rate_id := (v_checkout ->> 'shippingRateId')::uuid;
      v_items := v_checkout -> 'items';
      v_customer := v_checkout -> 'customer';
      v_fee_minor := coalesce((v_checkout ->> 'paymentFeeMinor')::bigint, 0);
    exception when others then
      raise exception 'Los datos del checkout aprobado no son válidos';
    end;

    if coalesce((v_checkout ->> 'version')::integer, 0) <> 1
      or jsonb_typeof(v_items) <> 'array'
      or jsonb_typeof(v_customer) <> 'object'
      or v_fee_minor < 0
    then
      raise exception 'Los datos del checkout aprobado están incompletos';
    end if;

    v_item_count := jsonb_array_length(v_items);
    if v_item_count < 1 or v_item_count > 50 then
      raise exception 'La cantidad de artículos del checkout no es válida';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_items) item
      where item ->> 'itemType' not in ('catalog', 'design')
        or coalesce((item ->> 'quantity')::integer, 0) not between 1 and 99
        or coalesce((item ->> 'unitPriceMinor')::bigint, -1) < 0
        or (item ->> 'itemType' = 'design' and (item ->> 'quantity')::integer <> 1)
    ) then
      raise exception 'Uno de los artículos del checkout no es válido';
    end if;

    select * into v_cart
    from public.carts
    where id = v_cart_id and user_id = v_user_id
    for update;
    if not found then raise exception 'El carrito del pago aprobado no existe'; end if;

    select * into v_shipping
    from public.shipping_rates
    where id = v_shipping_rate_id;
    if not found then raise exception 'La modalidad de entrega del pago aprobado no existe'; end if;

    select count(*) into v_catalog_count
    from jsonb_array_elements(v_items) item
    join public.commerce_variants variant on variant.id = (item ->> 'sourceId')::uuid
    join public.commerce_products product on product.id = variant.product_id
    where item ->> 'itemType' = 'catalog';

    select count(*) into v_design_count
    from jsonb_array_elements(v_items) item
    join public.designs design
      on design.id = (item ->> 'sourceId')::uuid
     and design.user_id = v_user_id
    where item ->> 'itemType' = 'design';

    if v_catalog_count + v_design_count <> v_item_count then
      raise exception 'Uno de los artículos del pago aprobado ya no existe';
    end if;

    select coalesce(sum(
      (item ->> 'unitPriceMinor')::bigint * (item ->> 'quantity')::integer
    ), 0)::bigint
    into v_items_subtotal
    from jsonb_array_elements(v_items) item;

    v_expected_total := v_items_subtotal + v_fee_minor;
    v_has_custom := v_design_count > 0;
    v_target_status := case
      when v_currency <> 'UYU' or v_amount_minor <> v_expected_total then 'manual_review'
      when v_has_custom then 'paid_pending_review'
      else 'ready_for_fulfillment'
    end;

    insert into public.orders (
      user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
      total_minor, shipping_method, shipping_snapshot, customer_snapshot,
      checkout_idempotency_key, reservation_expires_at, paid_at
    ) values (
      v_user_id, v_cart.id, v_target_status, v_items_subtotal, 0, v_fee_minor,
      v_expected_total,
      case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
      (to_jsonb(v_shipping) - 'rate_minor') || jsonb_build_object('paymentTiming', 'on_delivery'),
      v_customer,
      v_reference,
      null,
      coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now())
    ) returning * into v_order;

    insert into public.order_items (
      order_id, item_type, source_variant_id, sku, title, quantity,
      unit_price_minor, total_minor, immutable_snapshot, requires_review
    )
    select
      v_order.id,
      'catalog',
      variant.id,
      variant.sku,
      product.name || ' — ' || variant.name,
      (item ->> 'quantity')::integer,
      (item ->> 'unitPriceMinor')::bigint,
      (item ->> 'unitPriceMinor')::bigint * (item ->> 'quantity')::integer,
      jsonb_build_object('product', to_jsonb(product), 'variant', to_jsonb(variant)),
      false
    from jsonb_array_elements(v_items) item
    join public.commerce_variants variant on variant.id = (item ->> 'sourceId')::uuid
    join public.commerce_products product on product.id = variant.product_id
    where item ->> 'itemType' = 'catalog';

    insert into public.order_items (
      order_id, item_type, source_design_id, title, quantity,
      unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status
    )
    select
      v_order.id,
      'design',
      design.id,
      design.title,
      1,
      (item ->> 'unitPriceMinor')::bigint,
      (item ->> 'unitPriceMinor')::bigint,
      jsonb_build_object(
        'schemaVersion', design.schema_version,
        'configuration', design.configuration,
        'flejeConfiguration', design.fleje_configuration,
        'previewPath', design.preview_path,
        'assets', coalesce((
          select jsonb_agg(to_jsonb(asset))
          from public.design_assets asset
          where asset.design_id = design.id
        ), '[]'::jsonb)
      ),
      true,
      'pending'
    from jsonb_array_elements(v_items) item
    join public.designs design
      on design.id = (item ->> 'sourceId')::uuid
     and design.user_id = v_user_id
    where item ->> 'itemType' = 'design';

    update public.carts
    set status = 'converted'
    where id = v_cart.id and status = 'active';
  else
    if v_currency <> 'UYU' or v_amount_minor <> v_order.total_minor then
      update public.orders set status = 'manual_review' where id = v_order.id;
    elsif v_status = 'approved' and v_order.status = 'pending_payment' then
      select exists (
        select 1 from public.order_items where order_id = v_order.id and requires_review
      ) into v_has_custom;
      v_target_status := case when v_has_custom then 'paid_pending_review' else 'ready_for_fulfillment' end;
      update public.orders
      set status = v_target_status,
          paid_at = coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now())
      where id = v_order.id
      returning * into v_order;
    elsif v_status in ('refunded', 'charged_back') then
      update public.orders set status = 'refunded' where id = v_order.id returning * into v_order;
    end if;
  end if;

  insert into public.commerce_payments (
    order_id, provider_payment_id, status, status_detail,
    amount_minor, currency, raw_payload, approved_at
  ) values (
    v_order.id,
    v_payment_id,
    v_status,
    v_status_detail,
    v_amount_minor,
    'UYU',
    p_payment,
    case when v_status = 'approved'
      then coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now())
      else null
    end
  )
  on conflict (provider_payment_id) do update set
    status = excluded.status,
    status_detail = excluded.status_detail,
    amount_minor = excluded.amount_minor,
    raw_payload = excluded.raw_payload,
    approved_at = coalesce(public.commerce_payments.approved_at, excluded.approved_at),
    updated_at = now();

  update public.payment_webhook_events
  set processed_at = now(),
      processing_error = case
        when v_currency <> 'UYU' or v_amount_minor <> v_order.total_minor
          then 'monto o moneda no coincide'
        else null
      end
  where id = v_event_id;

  return jsonb_build_object(
    'processed', true,
    'orderId', v_order.id,
    'paymentStatus', v_status,
    'manualReview', v_order.status = 'manual_review'
  );
end;
$$;

revoke all on function public.process_mercado_pago_payment(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.process_mercado_pago_payment(text, text, jsonb, jsonb) to service_role;

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
    select id
    from public.orders
    where status = 'pending_payment'
      and reservation_expires_at < now()
      and not exists (
        select 1 from public.commerce_payments payment
        where payment.order_id = orders.id and payment.status = 'approved'
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

-- Remove legacy domestic attempts which never produced an approved payment.
-- International requests are deliberately retained because they are confirmed
-- manually over WhatsApp rather than through Mercado Pago.
create temporary table doomed_unpaid_orders on commit drop as
select orders.id
from public.orders
where orders.shipping_method <> 'international_coordination'
  and orders.status in ('pending_payment', 'payment_failed', 'cancelled')
  and not exists (
    select 1 from public.commerce_payments payment
    where payment.order_id = orders.id and payment.status = 'approved'
  );

delete from public.commerce_payments payment
using doomed_unpaid_orders doomed
where payment.order_id = doomed.id;

delete from public.order_items item
using doomed_unpaid_orders doomed
where item.order_id = doomed.id;

delete from public.orders order_row
using doomed_unpaid_orders doomed
where order_row.id = doomed.id;

comment on function public.process_mercado_pago_payment(text, text, jsonb, jsonb)
is 'Persists only approved Mercado Pago checkouts, idempotently creating the order and payment in one transaction. Non-approved attempts leave no local record.';
