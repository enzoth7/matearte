-- The eligibility threshold still counts mates only. Once met, selected categories receive the discount.
alter table public.commerce_settings
  add column if not exists wholesale_discount_categories text[] not null default array['mates']::text[];

alter table public.commerce_settings
  drop constraint if exists commerce_settings_wholesale_discount_categories_check;
alter table public.commerce_settings
  add constraint commerce_settings_wholesale_discount_categories_check
  check (cardinality(wholesale_discount_categories) between 1 and 30);

update public.commerce_settings
set wholesale_discount_categories = array['mates', 'bombillas']::text[]
where singleton = true
  and wholesale_discount_categories = array['mates']::text[];

CREATE OR REPLACE FUNCTION public.create_wholesale_bank_transfer_order(p_user_id uuid, p_cart_id uuid, p_shipping_rate_id uuid, p_design_prices jsonb, p_customer_snapshot jsonb, p_idempotency_key uuid, p_receipt_id uuid, p_receipt_storage_path text, p_receipt_original_name text, p_receipt_mime_type text, p_receipt_byte_size bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cart public.carts%rowtype;
  v_existing public.orders%rowtype;
  v_settings public.commerce_settings%rowtype;
  v_bank_settings public.commerce_bank_transfer_settings%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_variant record;
  v_design record;
  v_order public.orders%rowtype;
  v_mate_quantity integer := 0;
  v_catalog_subtotal bigint := 0;
  v_design_subtotal bigint := 0;
  v_design_price bigint;
  v_unit_price bigint;
  v_has_custom boolean := false;
begin
  -- Serialize retries for the same customer/key before checking for an existing
  -- order, so concurrent submissions return the first committed result.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0)
  );

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
  if not coalesce(v_settings.wholesale_mate_discount_enabled, false)
     or v_settings.wholesale_mate_discount_percent <= 0 then
    raise exception 'La compra mayorista no está habilitada';
  end if;

  select * into v_bank_settings
  from public.commerce_bank_transfer_settings
  where singleton;
  if not found then raise exception 'La transferencia bancaria no está configurada'; end if;

  if p_receipt_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or p_receipt_byte_size < 1 or p_receipt_byte_size > 5242880 then
    raise exception 'El comprobante no es válido';
  end if;
  if split_part(p_receipt_storage_path, '/', 1) <> p_user_id::text then
    raise exception 'La ruta del comprobante no es válida';
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = p_user_id and status = 'active'
  for update;
  if not found then raise exception 'El carrito no está disponible'; end if;
  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'El carrito está vacío';
  end if;

  select * into v_shipping
  from public.shipping_rates
  where id = p_shipping_rate_id and active;
  if not found then raise exception 'La modalidad de entrega no está disponible'; end if;

  select coalesce(sum(item.quantity), 0)::integer
  into v_mate_quantity
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = p_cart_id
    and item.item_type = 'catalog'
    and lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = 'mates';

  if v_mate_quantity < v_settings.wholesale_mate_quantity_threshold then
    raise exception 'El pedido no alcanza el mínimo mayorista';
  end if;

  for v_variant in
    select variant.*, product.name as product_name, product.sale_mode, product.published,
           product.category, product.category_code, item.quantity
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
    v_unit_price := case
      when lower(trim(coalesce(nullif(v_variant.category_code, ''), v_variant.category))) = any(v_settings.wholesale_discount_categories)
      then greatest(0, round(v_variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
      else v_variant.price_minor
    end;
    v_catalog_subtotal := v_catalog_subtotal + v_unit_price * v_variant.quantity;
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
    v_has_custom := true;
  end loop;

  if (select count(*) from public.cart_items where cart_id = p_cart_id and item_type = 'design') <>
     (select count(*) from public.cart_items item join public.designs design on design.id = item.design_id
      where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id) then
    raise exception 'El carrito contiene un diseño inválido';
  end if;

  insert into public.orders (
    user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
    total_minor, shipping_method, shipping_snapshot, customer_snapshot,
    checkout_idempotency_key, reservation_expires_at
  ) values (
    p_user_id, p_cart_id, 'payment_verification_pending',
    v_catalog_subtotal + v_design_subtotal, 0, 0,
    v_catalog_subtotal + v_design_subtotal,
    case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
    to_jsonb(v_shipping) || jsonb_build_object('channel', 'bank_transfer', 'payOnDelivery', not v_shipping.is_pickup),
    p_customer_snapshot || jsonb_build_object('purchaseFlow', 'wholesale_bank_transfer'),
    p_idempotency_key, null
  ) returning * into v_order;

  insert into public.order_items (
    order_id, item_type, source_variant_id, sku, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review
  )
  select v_order.id, 'catalog', variant.id, variant.sku,
         product.name || ' — ' || variant.name, item.quantity,
         case
           when lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = any(v_settings.wholesale_discount_categories)
           then greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
           else variant.price_minor
         end,
         (case
           when lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = any(v_settings.wholesale_discount_categories)
           then greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
           else variant.price_minor
         end) * item.quantity,
         jsonb_build_object(
           'product', to_jsonb(product),
           'variant', to_jsonb(variant),
           'selectedOptions', coalesce(item.option_values_override, variant.option_values, '{}'::jsonb),
           'wholesaleBankTransfer', lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = any(v_settings.wholesale_discount_categories)
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

  insert into public.commerce_bank_transfer_receipts (
    id, order_id, user_id, storage_path, original_name, mime_type, byte_size
  ) values (
    p_receipt_id, v_order.id, p_user_id, p_receipt_storage_path,
    left(p_receipt_original_name, 240), p_receipt_mime_type, p_receipt_byte_size
  );

  update public.carts set status = 'converted' where id = p_cart_id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'totalMinor', v_order.total_minor,
    'hasCustom', v_has_custom,
    'existing', false
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.apply_wholesale_discount_to_paypal_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_settings public.commerce_settings%rowtype;
  v_mate_quantity integer := 0;
  v_discount_minor bigint := 0;
  v_usd_rate numeric;
begin
  if new.shipping_method <> 'international_shipping' or new.cart_id is null then
    return new;
  end if;

  select * into v_settings
  from public.commerce_settings
  where singleton = true;

  select coalesce(sum(item.quantity), 0)::integer
  into v_mate_quantity
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = new.cart_id
    and item.item_type = 'catalog'
    and lower(trim(coalesce(product.category_code, product.category))) = 'mates';

  if coalesce(v_settings.wholesale_mate_discount_enabled, false)
     and v_mate_quantity >= v_settings.wholesale_mate_quantity_threshold
     and v_settings.wholesale_mate_discount_percent > 0 then
    select coalesce(sum(
      (variant.price_minor - private.wholesale_mate_unit_price(
        variant.price_minor,
        true,
        true,
        v_mate_quantity,
        v_settings.wholesale_mate_quantity_threshold,
        v_settings.wholesale_mate_discount_percent
      )) * item.quantity
    ), 0)::bigint
    into v_discount_minor
    from public.cart_items item
    join public.commerce_variants variant on variant.id = item.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where item.cart_id = new.cart_id
      and item.item_type = 'catalog'
      and lower(trim(coalesce(product.category_code, product.category))) = any(v_settings.wholesale_discount_categories);

    new.items_subtotal_minor := greatest(0, new.items_subtotal_minor - v_discount_minor);
    new.total_minor := new.items_subtotal_minor + new.shipping_minor + new.payment_fee_minor;
  end if;

  select rate_to_uyu into v_usd_rate
  from public.commerce_exchange_rates
  where currency_code = 'USD';
  if coalesce(v_usd_rate, 0) > 0 then
    new.paypal_amount_usd_minor := round(new.total_minor::numeric / v_usd_rate)::bigint;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.apply_wholesale_discount_to_paypal_order_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_cart_id uuid;
  v_shipping_method text;
  v_category text;
  v_settings public.commerce_settings%rowtype;
  v_mate_quantity integer := 0;
begin
  if new.item_type <> 'catalog' or new.source_variant_id is null then
    return new;
  end if;

  select cart_id, shipping_method
  into v_cart_id, v_shipping_method
  from public.orders
  where id = new.order_id;
  if v_shipping_method <> 'international_shipping' or v_cart_id is null then
    return new;
  end if;

  select coalesce(product.category_code, product.category)
  into v_category
  from public.commerce_variants variant
  join public.commerce_products product on product.id = variant.product_id
  where variant.id = new.source_variant_id;
  select * into v_settings
  from public.commerce_settings
  where singleton = true;

  if not coalesce(lower(trim(v_category)) = any(v_settings.wholesale_discount_categories), false) then
    return new;
  end if;

  select coalesce(sum(item.quantity), 0)::integer
  into v_mate_quantity
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = v_cart_id
    and item.item_type = 'catalog'
    and coalesce(product.category_code, product.category) = 'mates';

  new.unit_price_minor := private.wholesale_mate_unit_price(
    new.unit_price_minor,
    true,
    coalesce(v_settings.wholesale_mate_discount_enabled, false),
    v_mate_quantity,
    v_settings.wholesale_mate_quantity_threshold,
    v_settings.wholesale_mate_discount_percent
  );
  new.total_minor := new.unit_price_minor * new.quantity;
  return new;
end;
$function$;
