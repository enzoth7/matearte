-- Descuento por pedido mayorista. Se guarda el porcentaje en cada línea del pedido
-- (order_items.discount_percent) para poder mostrar Subtotal / Descuento / Total y editarlo después.
-- order_lines es una vista sobre order_items + orders: se expone la columna y el trigger la persiste.
alter table public.order_items
  add column if not exists discount_percent numeric
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

comment on column public.order_items.discount_percent is
  'Descuento (0-100) aplicado a la línea mayorista; total_minor y total_arg ya vienen descontados.';

create or replace view public.order_lines with (security_invoker = true) as
 SELECT COALESCE(i.immutable_snapshot ->> 'lineId'::text, i.id::text) AS line_id,
    o.reference_code AS order_id,
    o.customer_name AS customer,
    COALESCE(i.immutable_snapshot ->> 'model'::text, split_part(i.title, ' — '::text, 1)) AS model,
    COALESCE(i.immutable_snapshot ->> 'variant'::text, split_part(i.title, ' — '::text, 2)) AS variant,
    i.quantity,
        CASE i.production_status
            WHEN 'completed'::text THEN 'Completado'::text
            WHEN 'in_production'::text THEN 'En producción'::text
            ELSE 'Pendiente'::text
        END AS status,
    i.created_at,
    i.completed_at,
    i.unit_price_arg,
    (i.immutable_snapshot ->> 'unitPriceUyu'::text)::numeric AS unit_price_uyu,
    i.exchange_rate,
    i.total_arg,
    (i.immutable_snapshot ->> 'totalUyu'::text)::numeric AS total_uyu,
        CASE
            WHEN i.no_cost THEN 'no_cost'::text
            ELSE 'normal'::text
        END AS order_type,
    COALESCE(i.immutable_snapshot ->> 'saleChannel'::text, o.customer_snapshot ->> 'saleChannel'::text, 'WhatsApp'::text) AS sale_channel,
    i.discount_percent
   FROM order_items i
     JOIN orders o ON o.id = i.order_id
  WHERE o.channel = 'Mayorista'::text;

CREATE OR REPLACE FUNCTION private.order_lines_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_item uuid; v_old_order uuid; v_order uuid; v_variant record; v_unit bigint; v_total bigint; v_status text; v_discount numeric;
begin
  perform private.require_internal_staff();
  if tg_op in ('UPDATE', 'DELETE') then
    select i.id, i.order_id into v_item, v_old_order from public.order_items i join public.orders o on o.id = i.order_id
    where o.channel = 'Mayorista' and coalesce(i.immutable_snapshot ->> 'lineId', i.id::text) = old.line_id;
    if v_item is null then return null; end if;
  end if;

  if tg_op = 'DELETE' then
    delete from public.order_items where id = v_item;
    perform private.refresh_wholesale_order(v_old_order);
    return old;
  end if;

  if new.quantity is null or new.quantity < 1 then raise exception 'La cantidad debe ser un entero positivo.' using errcode = '22023'; end if;
  if nullif(btrim(new.model), '') is null or nullif(btrim(new.variant), '') is null then raise exception 'Modelo y variante son obligatorios.' using errcode = '22023'; end if;
  if not exists (select 1 from public.customers where full_name = new.customer) then
    raise exception 'El cliente mayorista no existe' using errcode = '23503';
  end if;
  if new.discount_percent is not null and (new.discount_percent < 0 or new.discount_percent > 100) then
    raise exception 'El descuento tiene que estar entre 0%% y 100%%.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    perform private.assert_wholesale_line_available(new.model, new.variant);
  end if;

  select variant.id, variant.sku into v_variant from public.commerce_variants variant
  join public.commerce_products product on product.id = variant.product_id
  where lower(btrim(product.name)) = lower(btrim(new.model)) and lower(btrim(variant.name)) = lower(btrim(new.variant))
  order by variant.available_wholesale desc, variant.sku limit 1;

  v_discount := nullif(coalesce(new.discount_percent, 0), 0);
  v_unit := coalesce(round(new.unit_price_uyu * 100), 0)::bigint;
  v_total := round(v_unit * new.quantity * (1 - coalesce(v_discount, 0) / 100))::bigint;
  v_status := case new.status when 'Completado' then 'completed' when 'En producción' then 'in_production' else 'pending' end;

  if tg_op = 'INSERT' then
    v_order := private.wholesale_order_for(new.order_id, new.customer, new.sale_channel, new.created_at);
    new.line_id := coalesce(nullif(btrim(new.line_id), ''), 'line-' || gen_random_uuid()::text);
    insert into public.order_items (order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
      immutable_snapshot, requires_review, created_at, production_status, completed_at, unit_price_arg, total_arg, exchange_rate, no_cost, discount_percent)
    values (v_order, 'catalog', v_variant.id, v_variant.sku, new.model || ' — ' || new.variant, new.quantity, v_unit, v_total,
      jsonb_build_object('source', 'wholesale', 'lineId', new.line_id, 'model', new.model, 'variant', new.variant,
        'saleChannel', coalesce(new.sale_channel, 'WhatsApp'), 'unitPriceUyu', new.unit_price_uyu, 'totalUyu', new.total_uyu),
      false, coalesce(new.created_at, now()), v_status, new.completed_at, new.unit_price_arg, new.total_arg, new.exchange_rate,
      coalesce(new.order_type, 'normal') = 'no_cost', v_discount);
    update public.orders set customer_name = new.customer where id = v_order and customer_name is distinct from new.customer;
    perform private.refresh_wholesale_order(v_order);
    new.created_at := coalesce(new.created_at, now());
    return new;
  end if;

  if nullif(btrim(new.order_id), '') is null or new.order_id = old.order_id then
    v_order := v_old_order;
  else
    v_order := private.wholesale_order_for(new.order_id, new.customer, new.sale_channel, old.created_at);
  end if;
  update public.order_items set
    order_id = v_order, quantity = new.quantity, title = new.model || ' — ' || new.variant,
    source_variant_id = case when (new.model, new.variant) is distinct from (old.model, old.variant) then v_variant.id else source_variant_id end,
    sku = case when (new.model, new.variant) is distinct from (old.model, old.variant) then v_variant.sku else sku end,
    unit_price_minor = v_unit, total_minor = v_total,
    production_status = v_status, completed_at = new.completed_at,
    unit_price_arg = new.unit_price_arg, total_arg = new.total_arg, exchange_rate = new.exchange_rate,
    no_cost = coalesce(new.order_type, 'normal') = 'no_cost',
    discount_percent = v_discount,
    immutable_snapshot = immutable_snapshot || jsonb_build_object('lineId', new.line_id, 'model', new.model, 'variant', new.variant,
      'saleChannel', coalesce(new.sale_channel, 'WhatsApp'), 'unitPriceUyu', new.unit_price_uyu, 'totalUyu', new.total_uyu)
  where id = v_item;
  update public.orders set customer_name = new.customer where id = v_order and customer_name is distinct from new.customer;
  perform private.refresh_wholesale_order(v_order);
  if v_order <> v_old_order then perform private.refresh_wholesale_order(v_old_order); end if;
  return new;
end $function$;
