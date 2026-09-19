-- Migración: Incorporar costo de envío y peso en la creación de órdenes internacionales de PayPal
-- Fecha: 2026-09-19

-- Ampliar el check constraint de shipping_method para incluir el flujo PayPal internacional
alter table public.orders
  drop constraint if exists orders_shipping_method_check;

alter table public.orders
  add constraint orders_shipping_method_check
  check (shipping_method in ('pickup', 'national_shipping', 'international_coordination', 'international_shipping'));

create or replace function public.create_paypal_international_order(
  p_user_id uuid,
  p_cart_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
  p_destination_snapshot jsonb,
  p_idempotency_key uuid,
  p_paypal_amount_usd_minor bigint,
  p_shipping_minor bigint default 0,
  p_peso integer default 0
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
  v_shipping_minor bigint := coalesce(p_shipping_minor, 0);
  v_total_minor bigint := 0;
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
      'shippingMinor', v_existing.shipping_minor,
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
  v_total_minor := v_items_subtotal + v_shipping_minor;

  insert into public.orders (
    user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
    total_minor, shipping_method, shipping_snapshot, customer_snapshot,
    checkout_idempotency_key, reservation_expires_at, paypal_amount_usd_minor, peso
  ) values (
    p_user_id, p_cart_id, 'pending_payment', v_items_subtotal, v_shipping_minor, 0,
    v_total_minor, 'international_shipping',
    p_destination_snapshot || jsonb_build_object('quoteRequired', false, 'channel', 'paypal', 'shippingMinor', v_shipping_minor, 'weightGrams', coalesce(p_peso, 0)),
    p_customer_snapshot || jsonb_build_object('purchaseFlow', 'international_paypal'),
    p_idempotency_key, null, p_paypal_amount_usd_minor, coalesce(p_peso, 0)
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
           'design', to_jsonb(design)
         ),
         true, 'pending'
  from public.cart_items item
  join public.designs design on design.id = item.design_id
  where item.cart_id = p_cart_id and item.item_type = 'design';

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'shippingMinor', v_order.shipping_minor,
    'totalMinor', v_order.total_minor,
    'existing', false
  );
end;
$$;

revoke all on function public.create_paypal_international_order(uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.create_paypal_international_order(uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint, bigint, integer) to service_role;
