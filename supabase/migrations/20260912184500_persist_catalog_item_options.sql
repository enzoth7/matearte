-- Preserve the exact catalog choices made by the customer in carts and orders.
-- A single generic variant can now be added more than once with different choices.

alter table public.cart_items
  add column if not exists option_values_override jsonb;

update public.cart_items item
set option_values_override = coalesce(variant.option_values, '{}'::jsonb)
from public.commerce_variants variant
where item.variant_id = variant.id
  and item.item_type = 'catalog'
  and coalesce(item.option_values_override, '{}'::jsonb) = '{}'::jsonb;

update public.cart_items
set option_values_override = '{}'::jsonb
where option_values_override is null;

alter table public.cart_items
  alter column option_values_override set default '{}'::jsonb,
  alter column option_values_override set not null;

drop index if exists public.cart_items_variant_unique_idx;
create unique index cart_items_variant_options_unique_idx
  on public.cart_items (cart_id, variant_id, option_values_override)
  where variant_id is not null;

update public.order_items
set immutable_snapshot = jsonb_set(
  immutable_snapshot,
  '{selectedOptions}',
  coalesce(immutable_snapshot -> 'variant' -> 'option_values', '{}'::jsonb),
  true
)
where item_type = 'catalog'
  and not (immutable_snapshot ? 'selectedOptions');

create or replace function public.create_international_order_request(
  p_user_id uuid,
  p_cart_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
  p_destination_snapshot jsonb,
  p_idempotency_key uuid
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
    checkout_idempotency_key, reservation_expires_at
  ) values (
    p_user_id, p_cart_id, 'manual_review', v_items_subtotal, 0, 0,
    v_items_subtotal, 'international_coordination',
    p_destination_snapshot || jsonb_build_object('quoteRequired', true, 'channel', 'whatsapp'),
    p_customer_snapshot || jsonb_build_object('purchaseFlow', 'international_whatsapp'),
    p_idempotency_key, null
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

  update public.carts set status = 'converted' where id = p_cart_id;

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

revoke all on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid) to service_role;

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
        or (item ->> 'itemType' = 'catalog' and jsonb_typeof(coalesce(item -> 'selectedOptions', '{}'::jsonb)) <> 'object')
        or (item ->> 'itemType' = 'catalog' and exists (
          select 1 from jsonb_each(coalesce(item -> 'selectedOptions', '{}'::jsonb)) option_value
          where jsonb_typeof(option_value.value) not in ('string', 'number', 'boolean')
        ))
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
      jsonb_build_object(
        'product', to_jsonb(product),
        'variant', to_jsonb(variant),
        'selectedOptions', coalesce(item -> 'selectedOptions', variant.option_values, '{}'::jsonb)
      ),
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
      update public.orders
      set status = 'manual_review'
      where id = v_order.id
      returning * into v_order;
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

comment on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid)
is 'Creates an international order while preserving the exact selected catalog options for every line item.';

comment on function public.process_mercado_pago_payment(text, text, jsonb, jsonb)
is 'Persists only approved Mercado Pago checkouts and preserves the exact selected catalog options for every line item.';
