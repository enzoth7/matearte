alter table public.orders
  drop constraint orders_shipping_method_check;

alter table public.orders
  add constraint orders_shipping_method_check
  check (shipping_method in ('pickup', 'national_shipping', 'international_coordination'));

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
    select v.*, p.name as product_name, p.sale_mode, p.published, ci.quantity
    from public.cart_items ci
    join public.commerce_variants v on v.id = ci.variant_id
    join public.commerce_products p on p.id = v.product_id
    where ci.cart_id = p_cart_id and ci.item_type = 'catalog'
    order by v.id
    for update of v
  loop
    if not v_variant.active or not v_variant.published then
      raise exception 'Una variante ya no está publicada';
    end if;
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
    if v_design_price is null or v_design_price <= 0 then
      raise exception 'No se pudo verificar el precio del diseño %', v_design.id;
    end if;
    v_design_subtotal := v_design_subtotal + v_design_price;
  end loop;

  if (select count(*) from public.cart_items where cart_id = p_cart_id and item_type = 'design') <>
     (select count(*) from public.cart_items ci join public.designs d on d.id = ci.design_id where ci.cart_id = p_cart_id and ci.item_type = 'design' and d.user_id = p_user_id)
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
  select v_order.id, 'catalog', v.id, v.sku, p.name || ' — ' || v.name, ci.quantity,
         v.price_minor, v.price_minor * ci.quantity,
         jsonb_build_object('product', to_jsonb(p), 'variant', to_jsonb(v)), false
  from public.cart_items ci
  join public.commerce_variants v on v.id = ci.variant_id
  join public.commerce_products p on p.id = v.product_id
  where ci.cart_id = p_cart_id and ci.item_type = 'catalog';

  insert into public.order_items (
    order_id, item_type, source_design_id, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status
  )
  select v_order.id, 'design', d.id, d.title, 1,
         (p_design_prices ->> d.id::text)::bigint,
         (p_design_prices ->> d.id::text)::bigint,
         jsonb_build_object(
           'schemaVersion', d.schema_version,
           'configuration', d.configuration,
           'flejeConfiguration', d.fleje_configuration,
           'previewPath', d.preview_path,
           'assets', coalesce(
             (select jsonb_agg(to_jsonb(a)) from public.design_assets a where a.design_id = d.id),
             '[]'::jsonb
           )
         ), true, 'pending'
  from public.cart_items ci
  join public.designs d on d.id = ci.design_id
  where ci.cart_id = p_cart_id and ci.item_type = 'design' and d.user_id = p_user_id;

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

revoke all on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid)
from public, anon, authenticated;

grant execute on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid)
to service_role;

comment on function public.create_international_order_request(uuid, uuid, jsonb, jsonb, jsonb, uuid)
is 'Creates an immutable, server-only international purchase request for manual shipping and payment coordination.';
