create or replace function public.create_checkout_order(
  p_user_id uuid,
  p_cart_id uuid,
  p_shipping_rate_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
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
  v_shipping public.shipping_rates%rowtype;
  v_variant record;
  v_design record;
  v_order public.orders%rowtype;
  v_catalog_subtotal bigint := 0;
  v_design_subtotal bigint := 0;
  v_items_subtotal bigint := 0;
  v_fee_minor bigint := 0;
  v_fee_percent numeric := 0;
  v_design_price bigint;
  v_has_custom boolean := false;
begin
  select * into v_existing from public.orders
  where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'orderNumber', v_existing.order_number, 'status', v_existing.status, 'totalMinor', v_existing.total_minor, 'existing', true);
  end if;

  select * into v_settings from public.commerce_settings where singleton for update;
  if not found or not v_settings.commerce_enabled or not v_settings.mercado_pago_enabled then
    raise exception 'El comercio todavía no está habilitado';
  end if;

  select * into v_cart from public.carts where id = p_cart_id and user_id = p_user_id and status = 'active' for update;
  if not found then raise exception 'El carrito no está disponible'; end if;
  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then raise exception 'El carrito está vacío'; end if;

  select * into v_shipping from public.shipping_rates where id = p_shipping_rate_id and active;
  if not found then raise exception 'La modalidad de entrega no está disponible'; end if;

  for v_variant in
    select v.*, p.name as product_name, p.sale_mode, p.published, ci.quantity
    from public.cart_items ci
    join public.commerce_variants v on v.id = ci.variant_id
    join public.commerce_products p on p.id = v.product_id
    where ci.cart_id = p_cart_id and ci.item_type = 'catalog'
    order by v.id
    for update of v
  loop
    if not v_variant.active or not v_variant.published then raise exception 'Una variante ya no está publicada'; end if;
    if v_variant.sale_mode = 'standard' and not v_variant.inventory_tracked then raise exception 'Una variante estándar no tiene control de stock'; end if;
    if v_variant.inventory_tracked and v_variant.stock_on_hand - v_variant.stock_reserved < v_variant.quantity then raise exception 'Stock insuficiente para %', v_variant.sku; end if;
    v_catalog_subtotal := v_catalog_subtotal + v_variant.price_minor * v_variant.quantity;
  end loop;

  for v_design in
    select d.*, ci.quantity
    from public.cart_items ci
    join public.designs d on d.id = ci.design_id
    where ci.cart_id = p_cart_id and ci.item_type = 'design' and d.user_id = p_user_id
    order by d.id
  loop
    v_design_price := nullif(p_design_prices ->> v_design.id::text, '')::bigint;
    if v_design_price is null or v_design_price <= 0 then raise exception 'No se pudo verificar el precio del diseño %', v_design.id; end if;
    v_design_subtotal := v_design_subtotal + v_design_price;
    v_has_custom := true;
  end loop;

  if (select count(*) from public.cart_items where cart_id = p_cart_id and item_type = 'design') <>
     (select count(*) from public.cart_items ci join public.designs d on d.id = ci.design_id where ci.cart_id = p_cart_id and ci.item_type = 'design' and d.user_id = p_user_id)
  then raise exception 'El carrito contiene un diseño inválido'; end if;

  v_items_subtotal := v_catalog_subtotal + v_design_subtotal;
  if v_settings.payment_fee_enabled and v_settings.payment_fee_legal_approval then
    select pcv.value into v_fee_percent
    from public.pricing_catalog_versions pv
    join public.pricing_catalog_values pcv on pcv.version_id = pv.id and pcv.rule_key = 'commission:mercado_pago'
    where pv.status = 'published'
    order by pv.version desc limit 1;
    if v_fee_percent is null or v_fee_percent < 0 then raise exception 'La regla de comisión no está publicada'; end if;
    v_fee_minor := round((v_items_subtotal + v_shipping.rate_minor) * v_fee_percent / 100.0);
  end if;

  insert into public.orders (
    user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
    total_minor, shipping_method, shipping_snapshot, customer_snapshot,
    checkout_idempotency_key, reservation_expires_at
  ) values (
    p_user_id, p_cart_id, 'pending_payment', v_items_subtotal, v_shipping.rate_minor, v_fee_minor,
    v_items_subtotal + v_shipping.rate_minor + v_fee_minor,
    case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
    to_jsonb(v_shipping), p_customer_snapshot, p_idempotency_key,
    now() + make_interval(mins => v_settings.reservation_minutes)
  ) returning * into v_order;

  insert into public.order_items (order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor, immutable_snapshot, requires_review)
  select v_order.id, 'catalog', v.id, v.sku, p.name || ' — ' || v.name, ci.quantity,
         v.price_minor, v.price_minor * ci.quantity,
         jsonb_build_object('product', to_jsonb(p), 'variant', to_jsonb(v)), false
  from public.cart_items ci
  join public.commerce_variants v on v.id = ci.variant_id
  join public.commerce_products p on p.id = v.product_id
  where ci.cart_id = p_cart_id and ci.item_type = 'catalog';

  insert into public.order_items (order_id, item_type, source_design_id, title, quantity, unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status)
  select v_order.id, 'design', d.id, d.title, 1,
         (p_design_prices ->> d.id::text)::bigint, (p_design_prices ->> d.id::text)::bigint,
         jsonb_build_object(
           'schemaVersion', d.schema_version,
           'configuration', d.configuration,
           'flejeConfiguration', d.fleje_configuration,
           'previewPath', d.preview_path,
           'assets', coalesce((select jsonb_agg(to_jsonb(a)) from public.design_assets a where a.design_id = d.id), '[]'::jsonb)
         ), true, 'pending'
  from public.cart_items ci join public.designs d on d.id = ci.design_id
  where ci.cart_id = p_cart_id and ci.item_type = 'design' and d.user_id = p_user_id;

  insert into public.inventory_reservations (order_id, variant_id, quantity, expires_at)
  select v_order.id, v.id, sum(ci.quantity)::integer, v_order.reservation_expires_at
  from public.cart_items ci join public.commerce_variants v on v.id = ci.variant_id
  where ci.cart_id = p_cart_id and ci.item_type = 'catalog' and v.inventory_tracked
  group by v.id;

  update public.commerce_variants v set stock_reserved = v.stock_reserved + r.quantity
  from public.inventory_reservations r where r.order_id = v_order.id and r.variant_id = v.id;
  update public.carts set status = 'converted' where id = p_cart_id;

  return jsonb_build_object(
    'id', v_order.id, 'orderNumber', v_order.order_number, 'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor, 'shippingMinor', v_order.shipping_minor,
    'paymentFeeMinor', v_order.payment_fee_minor, 'totalMinor', v_order.total_minor,
    'hasCustom', v_has_custom, 'existing', false
  );
end;
$$;

revoke all on function public.create_checkout_order(uuid, uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_checkout_order(uuid, uuid, uuid, jsonb, jsonb, uuid) to service_role;

comment on function public.create_checkout_order(uuid, uuid, uuid, jsonb, jsonb, uuid)
is 'Atomically rechecks the server cart, creates an immutable order and reserves inventory. Server-only.';
