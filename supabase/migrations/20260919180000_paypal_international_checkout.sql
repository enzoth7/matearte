-- Migration file: 20260919180000_paypal_international_checkout.sql

alter table public.orders
add column if not exists paypal_order_id text,
add column if not exists paypal_amount_usd_minor bigint;

alter table public.commerce_settings
add column if not exists paypal_enabled boolean not null default false;

alter table public.commerce_payments drop constraint if exists commerce_payments_provider_check;
alter table public.commerce_payments add constraint commerce_payments_provider_check check (provider in ('mercado_pago', 'paypal'));

alter table public.commerce_payments drop constraint if exists commerce_payments_currency_check;
alter table public.commerce_payments add constraint commerce_payments_currency_check check (currency in ('UYU', 'USD'));

alter table public.payment_webhook_events drop constraint if exists payment_webhook_events_provider_check;
alter table public.payment_webhook_events add constraint payment_webhook_events_provider_check check (provider in ('mercado_pago', 'paypal'));

-- Process PayPal Payment RPC
create or replace function public.process_paypal_payment(
  p_event_id text,
  p_event_type text,
  p_paypal_order_id text,
  p_capture_id text,
  p_amount_usd_minor bigint,
  p_capture_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order public.orders%rowtype;
  v_has_custom boolean;
  v_target_status text;
begin
  if coalesce(trim(p_event_id), '') = '' or p_paypal_order_id is null then
    raise exception 'Evento o orden de PayPal incompleta';
  end if;

  select * into v_order
  from public.orders
  where paypal_order_id = p_paypal_order_id
  for update;

  if not found then
    raise exception 'Orden de PayPal no encontrada';
  end if;

  begin
    insert into public.payment_webhook_events (provider, provider_event_id, event_type, signature_valid, payload)
    values ('paypal', p_event_id, p_event_type, true, p_capture_payload)
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true);
  end;

  if v_order.status = 'pending_payment' then
    select exists (
      select 1
      from public.order_items
      where order_id = v_order.id and requires_review = true
    ) into v_has_custom;

    if v_has_custom then
      v_target_status := 'paid_pending_review';
    else
      v_target_status := 'ready_for_fulfillment';
    end if;

    update public.orders
    set status = v_target_status,
        paid_at = now()
    where id = v_order.id;

    update public.carts
    set status = 'converted'
    where id = v_order.cart_id;
  else
    select exists (
      select 1
      from public.order_items
      where order_id = v_order.id and requires_review = true
    ) into v_has_custom;
  end if;

  insert into public.commerce_payments (
    order_id, provider, provider_payment_id, status, amount_minor, currency, raw_payload, approved_at
  ) values (
    v_order.id, 'paypal', p_capture_id, 'approved', p_amount_usd_minor, 'USD', p_capture_payload, now()
  )
  on conflict (provider_payment_id) do update
  set status = excluded.status,
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      raw_payload = excluded.raw_payload,
      approved_at = excluded.approved_at;

  update public.payment_webhook_events
  set processed_at = now()
  where id = v_event_id;

  return jsonb_build_object(
    'processed', true,
    'orderId', v_order.id,
    'paymentStatus', 'approved',
    'manualReview', v_has_custom
  );
end;
$$;

revoke all on function public.process_paypal_payment(text, text, text, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.process_paypal_payment(text, text, text, text, bigint, jsonb) to service_role;
comment on function public.process_paypal_payment(text, text, text, text, bigint, jsonb) is 'Procesa un pago capturado de PayPal';

-- Create PayPal International Order RPC
create or replace function public.create_paypal_international_order(
  p_user_id uuid,
  p_cart_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
  p_destination_snapshot jsonb,
  p_idempotency_key uuid,
  p_paypal_amount_usd_minor bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart public.carts%rowtype;
  v_existing public.orders%rowtype;
  v_settings public.commerce_settings%rowtype;
  v_variant record;
  v_design record;
  v_order public.orders%rowtype;
  v_catalog_subtotal bigint := 0;
  v_design_subtotal bigint := 0;
  v_items_subtotal bigint := 0;
  v_design_price bigint;
begin
  select * into v_existing
  from public.orders
  where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'orderNumber', v_existing.order_number,
      'status', v_existing.status,
      'totalMinor', v_existing.total_minor,
      'existing', true
    );
  end if;

  select * into v_settings
  from public.commerce_settings
  where singleton
  for update;

  if not found or not v_settings.commerce_enabled then
    raise exception 'El comercio todavía no está habilitado';
  end if;

  if coalesce(nullif(trim(p_destination_snapshot ->> 'country'), ''), '') = '' then
    raise exception 'Ingresá el país de destino';
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = p_user_id and status = 'active'
  for update;

  if not found then raise exception 'El carrito no está disponible'; end if;
  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'El carrito está vacío';
  end if;

  for v_variant in
    select variant.*, product.name as product_name, product.sale_mode, product.published,
           item.quantity, item.option_values_override
    from public.cart_items item
    join public.commerce_variants variant on variant.id = item.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where item.cart_id = p_cart_id and item.item_type = 'catalog'
    order by variant.id
    for update of variant
  loop
    if not v_variant.active or not v_variant.published then
      raise exception 'Una variante ya no está publicada';
    end if;
    v_catalog_subtotal := v_catalog_subtotal + v_variant.price_minor * v_variant.quantity;
  end loop;

  for v_design in
    select design.*, item.quantity
    from public.cart_items item
    join public.designs design on design.id = item.design_id
    where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id
    order by design.id
  loop
    v_design_price := nullif(p_design_prices ->> v_design.id::text, '')::bigint;
    if v_design_price is null or v_design_price <= 0 then
      raise exception 'No se pudo verificar el precio del diseño %', v_design.id;
    end if;
    v_design_subtotal := v_design_subtotal + v_design_price;
  end loop;

  if (select count(*) from public.cart_items where cart_id = p_cart_id and item_type = 'design') <>
     (select count(*) from public.cart_items item join public.designs design on design.id = item.design_id where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id)
  then
    raise exception 'El carrito contiene un diseño inválido';
  end if;

  v_items_subtotal := v_catalog_subtotal + v_design_subtotal;

  insert into public.orders (
    user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
    total_minor, shipping_method, shipping_snapshot, customer_snapshot,
    checkout_idempotency_key, reservation_expires_at, paypal_amount_usd_minor
  ) values (
    p_user_id, p_cart_id, 'pending_payment', v_items_subtotal, 0, 0,
    v_items_subtotal, 'international_coordination',
    p_destination_snapshot || jsonb_build_object('quoteRequired', true, 'channel', 'paypal'),
    p_customer_snapshot || jsonb_build_object('purchaseFlow', 'international_paypal'),
    p_idempotency_key, null, p_paypal_amount_usd_minor
  ) returning * into v_order;

  insert into public.order_items (
    order_id, item_type, source_variant_id, sku, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review
  )
  select v_order.id, 'catalog', variant.id, variant.sku,
         product.name || ' — ' || variant.name, item.quantity,
         variant.price_minor, variant.price_minor * item.quantity,
         jsonb_build_object(
           'product', to_jsonb(product),
           'variant', to_jsonb(variant),
           'selectedOptions', coalesce(item.option_values_override, variant.option_values, '{}'::jsonb)
         ),
         false
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = p_cart_id and item.item_type = 'catalog';

  insert into public.order_items (
    order_id, item_type, source_design_id, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status
  )
  select v_order.id, 'design', design.id, design.title, 1,
         (p_design_prices ->> design.id::text)::bigint,
         (p_design_prices ->> design.id::text)::bigint,
         jsonb_build_object(
           'schemaVersion', design.schema_version,
           'configuration', design.configuration,
           'flejeConfiguration', design.fleje_configuration,
           'previewPath', design.preview_path,
           'assets', coalesce(
             (select jsonb_agg(to_jsonb(asset)) from public.design_assets asset where asset.design_id = design.id),
             '[]'::jsonb
           )
         ), true, 'pending'
  from public.cart_items item
  join public.designs design on design.id = item.design_id
  where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'totalMinor', v_order.total_minor,
    'existing', false
  );
end;
$$;

revoke all on function public.create_paypal_international_order(uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint) from public, anon, authenticated;
grant execute on function public.create_paypal_international_order(uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint) to service_role;
comment on function public.create_paypal_international_order(uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint) is 'Crea una orden internacional para PayPal';
