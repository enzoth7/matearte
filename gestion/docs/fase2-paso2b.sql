-- Fase 2, paso 2b: ventas locales y pedidos mayoristas pasan a orders / order_items.
-- local_sales, local_sale_items y order_lines quedan como vistas compatibles (con escritura por
-- disparadores INSTEAD OF), así gestión, localventas y las funciones existentes siguen andando.
-- Las tablas originales se conservan en el esquema private como respaldo.
-- Todo corre en una sola transacción; el bloque final verifica conteos y totales y aborta si no cuadran.

-- 0) Guardas: el estado de partida es el que se relevó.
do $$
begin
  if (select count(*) from public.local_sales) <> 20 or (select count(*) from public.local_sale_items) <> 25
     or (select count(*) from public.order_lines) <> 225 or (select count(distinct order_id) from public.order_lines) <> 95
     or exists (select 1 from public.order_lines where order_id is null)
     or exists (select 1 from public.orders where channel not in ('Web', 'Mayorista web')) then
    raise exception 'El estado de partida no coincide con el relevado';
  end if;
end $$;

-- 1) Permisos de staff (mismo criterio que tenían las ventas locales).
create or replace function private.require_internal_staff() returns void language plpgsql stable security definer set search_path = '' as $f$
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
end $f$;

create policy orders_internal_staff_read on public.orders for select to authenticated
  using (channel not in ('Web', 'Mayorista web') and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy order_items_internal_staff_read on public.order_items for select to authenticated
  using (((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
         and exists (select 1 from public.orders o where o.id = order_items.order_id and o.channel not in ('Web', 'Mayorista web')));

-- 2) Códigos: los pedidos internos conservan el código que traen; si no traen, se asigna por canal.
create or replace function private.assign_commerce_reference() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_number bigint; v_prefix text; v_seq regclass;
begin
  if new.channel in ('Web', 'Mayorista web') then
    if new.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then
      new.channel := 'Mayorista web';
      v_seq := 'private.matearte_wholesale_reference_seq'; v_prefix := 'M';
    else
      v_seq := 'private.matearte_web_reference_seq'; v_prefix := 'W';
    end if;
  else
    if nullif(btrim(new.reference_code), '') is not null then return new; end if;
    if new.channel = 'Mayorista' then v_seq := 'private.matearte_wholesale_reference_seq'; v_prefix := 'M';
    elsif new.channel = 'Local' then v_seq := 'private.matearte_local_reference_seq'; v_prefix := 'L';
    elsif new.channel = 'Feria' then v_seq := 'private.matearte_fair_reference_seq'; v_prefix := 'F';
    else v_seq := 'private.matearte_social_reference_seq'; v_prefix := 'R';
    end if;
  end if;
  v_number := nextval(v_seq);
  new.reference_code := '#' || v_prefix || lpad(v_number::text, greatest(3, length(v_number::text)), '0');
  return new;
end $f$;

-- 3) La validación de la web no aplica a ítems de pedidos internos.
create or replace function private.check_web_order_item_availability() returns trigger language plpgsql set search_path = '' as $f$
begin
  if exists (select 1 from public.orders o where o.id = new.order_id and o.channel not in ('Web', 'Mayorista web')) then
    return new;
  end if;
  if new.item_type = 'catalog' and not exists (
    select 1 from public.commerce_variants variant join public.commerce_products product on product.id = variant.product_id
    where variant.id = new.source_variant_id and variant.active and variant.available_web and product.published
  ) then
    raise exception 'La variante ya no está disponible en la web' using errcode = '22023';
  end if;
  return new;
end $f$;

-- 4) Copia de ventas locales.
insert into public.orders (id, status, currency, items_subtotal_minor, shipping_minor, payment_fee_minor, total_minor,
  shipping_method, shipping_snapshot, customer_snapshot, created_at, updated_at, reference_code, channel,
  customer_name, sold_on, payment_method, deposit_minor)
select s.id, 'internal_completed', 'UYU', s.total_minor, 0, 0, s.total_minor, 'pickup', '{}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object('purchaseFlow', 'internal', 'legacySaleNumber', s.sale_number,
    'localCustomerId', s.customer_id, 'createdBy', s.created_by)),
  s.created_at, s.created_at, s.reference_code, s.channel, s.customer_name, s.sold_on, s.payment_method,
  case when s.payment_method = 'Seña' then s.total_minor end
from public.local_sales s;

insert into public.order_items (id, order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor,
  total_minor, immutable_snapshot, requires_review, created_at, production_status)
select i.id, i.sale_id, 'catalog', i.variant_id, i.sku, i.product_name || ' — ' || i.variant_name, i.quantity,
  i.unit_price_minor, i.unit_price_minor * i.quantity,
  jsonb_build_object('source', 'local', 'productName', i.product_name, 'variantName', i.variant_name)
    || case when i.customization is not null then jsonb_build_object('customization', i.customization) else '{}'::jsonb end,
  false, i.created_at, i.production_status
from public.local_sale_items i;

-- 5) Copia de pedidos mayoristas (un pedido por código #M, una línea por ítem).
insert into public.orders (status, currency, items_subtotal_minor, shipping_minor, payment_fee_minor, total_minor,
  shipping_method, shipping_snapshot, customer_snapshot, created_at, updated_at, reference_code, channel, customer_name, sold_on)
select case when bool_and(l.status = 'Completado') then 'internal_completed' else 'internal_open' end,
  'UYU', sum(coalesce(round(l.unit_price_uyu * 100), 0)::bigint * l.quantity), 0, 0,
  sum(coalesce(round(l.unit_price_uyu * 100), 0)::bigint * l.quantity), 'pickup', '{}'::jsonb,
  jsonb_build_object('purchaseFlow', 'internal', 'saleChannel', min(l.sale_channel)),
  min(l.created_at), min(l.created_at), l.order_id, 'Mayorista', min(l.customer), min(l.created_at)::date
from public.order_lines l
group by l.order_id;

insert into public.order_items (order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
  immutable_snapshot, requires_review, created_at, production_status, completed_at, unit_price_arg, total_arg, exchange_rate, no_cost)
select o.id, 'catalog', v.id, v.sku, l.model || ' — ' || l.variant, l.quantity,
  coalesce(round(l.unit_price_uyu * 100), 0)::bigint, coalesce(round(l.unit_price_uyu * 100), 0)::bigint * l.quantity,
  jsonb_build_object('source', 'wholesale', 'lineId', l.line_id, 'model', l.model, 'variant', l.variant,
    'saleChannel', l.sale_channel, 'unitPriceUyu', l.unit_price_uyu, 'totalUyu', l.total_uyu),
  false, l.created_at,
  case l.status when 'Completado' then 'completed' when 'En producción' then 'in_production' else 'pending' end,
  l.completed_at, l.unit_price_arg, l.total_arg, l.exchange_rate, l.order_type = 'no_cost'
from public.order_lines l
join public.orders o on o.reference_code = l.order_id and o.channel = 'Mayorista'
left join lateral (
  select variant.id, variant.sku from public.commerce_variants variant join public.commerce_products product on product.id = variant.product_id
  where lower(btrim(product.name)) = lower(btrim(l.model)) and lower(btrim(variant.name)) = lower(btrim(l.variant))
  order by variant.available_wholesale desc, variant.sku limit 1
) v on true;

-- 6) Las tablas originales pasan a private como respaldo (con sus datos intactos).
alter table public.order_lines set schema private;
alter table private.order_lines rename to legacy_order_lines_20261022;
alter table public.local_sale_items set schema private;
alter table private.local_sale_items rename to legacy_local_sale_items_20261022;
alter table public.local_sales set schema private;
alter table private.local_sales rename to legacy_local_sales_20261022;

-- 7) Vistas compatibles, con las mismas columnas que las tablas.
create view public.local_sales with (security_invoker = true) as
select o.id, coalesce((o.customer_snapshot ->> 'legacySaleNumber')::bigint, o.order_number) as sale_number,
  nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid as customer_id, o.customer_name, o.sold_on, o.payment_method,
  o.total_minor, o.currency, nullif(o.customer_snapshot ->> 'createdBy', '')::uuid as created_by, o.created_at,
  o.reference_code, o.channel
from public.orders o
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook');

create view public.local_sale_items with (security_invoker = true) as
select i.id, i.order_id as sale_id, i.source_variant_id as variant_id, coalesce(i.sku, '') as sku,
  coalesce(i.immutable_snapshot ->> 'productName', split_part(i.title, ' — ', 1)) as product_name,
  coalesce(i.immutable_snapshot ->> 'variantName', split_part(i.title, ' — ', 2)) as variant_name,
  i.quantity, i.unit_price_minor, i.total_minor as line_total_minor, i.created_at, i.production_status,
  i.immutable_snapshot -> 'customization' as customization
from public.order_items i
where exists (select 1 from public.orders o where o.id = i.order_id and o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook'));

create view public.order_lines with (security_invoker = true) as
select coalesce(i.immutable_snapshot ->> 'lineId', i.id::text) as line_id, o.reference_code as order_id,
  o.customer_name as customer,
  coalesce(i.immutable_snapshot ->> 'model', split_part(i.title, ' — ', 1)) as model,
  coalesce(i.immutable_snapshot ->> 'variant', split_part(i.title, ' — ', 2)) as variant,
  i.quantity,
  case i.production_status when 'completed' then 'Completado' when 'in_production' then 'En producción' else 'Pendiente' end as status,
  i.created_at, i.completed_at, i.unit_price_arg, (i.immutable_snapshot ->> 'unitPriceUyu')::numeric as unit_price_uyu,
  i.exchange_rate, i.total_arg, (i.immutable_snapshot ->> 'totalUyu')::numeric as total_uyu,
  case when i.no_cost then 'no_cost' else 'normal' end as order_type,
  coalesce(i.immutable_snapshot ->> 'saleChannel', o.customer_snapshot ->> 'saleChannel', 'WhatsApp') as sale_channel
from public.order_items i
join public.orders o on o.id = i.order_id
where o.channel = 'Mayorista';

revoke all on public.local_sales, public.local_sale_items, public.order_lines from public, anon;
grant select, insert, update, delete on public.local_sales, public.local_sale_items, public.order_lines to authenticated;

-- 8) Escritura sobre las vistas.
create or replace function private.refresh_wholesale_order(p_order_id uuid) returns void language plpgsql security definer set search_path = '' as $f$
begin
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    delete from public.orders where id = p_order_id and channel = 'Mayorista';
    return;
  end if;
  update public.orders o set
    items_subtotal_minor = s.total, total_minor = s.total,
    status = case when s.done then 'internal_completed' else 'internal_open' end
  from (select coalesce(sum(total_minor), 0)::bigint total, bool_and(production_status = 'completed') done
        from public.order_items where order_id = p_order_id) s
  where o.id = p_order_id and o.channel = 'Mayorista'
    and (o.items_subtotal_minor, o.status) is distinct from (s.total, case when s.done then 'internal_completed' else 'internal_open' end);
end $f$;

create or replace function private.wholesale_order_for(p_code text, p_customer text, p_sale_channel text, p_created_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $f$
declare v_order uuid;
begin
  if nullif(btrim(p_code), '') is null then raise exception 'Falta el número de pedido' using errcode = '22023'; end if;
  select id into v_order from public.orders where reference_code = p_code and channel = 'Mayorista' for update;
  if v_order is null then
    insert into public.orders (status, items_subtotal_minor, total_minor, shipping_method, customer_snapshot,
      reference_code, channel, customer_name, sold_on, created_at)
    values ('internal_open', 0, 0, 'pickup', jsonb_build_object('purchaseFlow', 'internal', 'saleChannel', coalesce(p_sale_channel, 'WhatsApp')),
      p_code, 'Mayorista', p_customer, coalesce(p_created_at, now())::date, coalesce(p_created_at, now()))
    returning id into v_order;
  end if;
  return v_order;
end $f$;

create or replace function private.order_lines_write() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_item uuid; v_old_order uuid; v_order uuid; v_variant record; v_unit bigint; v_status text;
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
  if tg_op = 'INSERT' then
    perform private.assert_wholesale_line_available(new.model, new.variant);
  end if;

  select variant.id, variant.sku into v_variant from public.commerce_variants variant
  join public.commerce_products product on product.id = variant.product_id
  where lower(btrim(product.name)) = lower(btrim(new.model)) and lower(btrim(variant.name)) = lower(btrim(new.variant))
  order by variant.available_wholesale desc, variant.sku limit 1;

  v_unit := coalesce(round(new.unit_price_uyu * 100), 0)::bigint;
  v_status := case new.status when 'Completado' then 'completed' when 'En producción' then 'in_production' else 'pending' end;

  if tg_op = 'INSERT' then
    v_order := private.wholesale_order_for(new.order_id, new.customer, new.sale_channel, new.created_at);
    new.line_id := coalesce(nullif(btrim(new.line_id), ''), 'line-' || gen_random_uuid()::text);
    insert into public.order_items (order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
      immutable_snapshot, requires_review, created_at, production_status, completed_at, unit_price_arg, total_arg, exchange_rate, no_cost)
    values (v_order, 'catalog', v_variant.id, v_variant.sku, new.model || ' — ' || new.variant, new.quantity, v_unit, v_unit * new.quantity,
      jsonb_build_object('source', 'wholesale', 'lineId', new.line_id, 'model', new.model, 'variant', new.variant,
        'saleChannel', coalesce(new.sale_channel, 'WhatsApp'), 'unitPriceUyu', new.unit_price_uyu, 'totalUyu', new.total_uyu),
      false, coalesce(new.created_at, now()), v_status, new.completed_at, new.unit_price_arg, new.total_arg, new.exchange_rate,
      coalesce(new.order_type, 'normal') = 'no_cost');
    update public.orders set customer_name = new.customer where id = v_order and customer_name is distinct from new.customer;
    perform private.refresh_wholesale_order(v_order);
    new.created_at := coalesce(new.created_at, now());
    return new;
  end if;

  -- UPDATE: si el código no cambia (o viene vacío) la línea se queda en su pedido.
  if nullif(btrim(new.order_id), '') is null or new.order_id = old.order_id then
    v_order := v_old_order;
  else
    v_order := private.wholesale_order_for(new.order_id, new.customer, new.sale_channel, old.created_at);
  end if;
  update public.order_items set
    order_id = v_order, quantity = new.quantity, title = new.model || ' — ' || new.variant,
    source_variant_id = case when (new.model, new.variant) is distinct from (old.model, old.variant) then v_variant.id else source_variant_id end,
    sku = case when (new.model, new.variant) is distinct from (old.model, old.variant) then v_variant.sku else sku end,
    unit_price_minor = v_unit, total_minor = v_unit * new.quantity,
    production_status = v_status, completed_at = new.completed_at,
    unit_price_arg = new.unit_price_arg, total_arg = new.total_arg, exchange_rate = new.exchange_rate,
    no_cost = coalesce(new.order_type, 'normal') = 'no_cost',
    immutable_snapshot = immutable_snapshot || jsonb_build_object('lineId', new.line_id, 'model', new.model, 'variant', new.variant,
      'saleChannel', coalesce(new.sale_channel, 'WhatsApp'), 'unitPriceUyu', new.unit_price_uyu, 'totalUyu', new.total_uyu)
  where id = v_item;
  update public.orders set customer_name = new.customer where id = v_order and customer_name is distinct from new.customer;
  perform private.refresh_wholesale_order(v_order);
  if v_order <> v_old_order then perform private.refresh_wholesale_order(v_old_order); end if;
  return new;
end $f$;

create or replace function private.assert_wholesale_line_available(p_model text, p_variant text) returns void language plpgsql stable security definer set search_path = '' as $f$
begin
  if p_variant = 'Genérico' then
    if not exists (select 1 from public.commerce_products p join public.commerce_variants v on v.product_id = p.id
                   where lower(btrim(p.name)) = lower(btrim(p_model)) and v.available_wholesale) then
      raise exception 'El producto ya no está disponible para Mayorista' using errcode = '22023';
    end if;
    return;
  end if;
  if not exists (select 1 from public.commerce_products p join public.commerce_variants v on v.product_id = p.id
                 where lower(btrim(p.name)) = lower(btrim(p_model)) and lower(btrim(v.name)) = lower(btrim(p_variant)) and v.available_wholesale)
     or exists (select 1 from public.commerce_products p join public.commerce_variants v on v.product_id = p.id
                where lower(btrim(p.name)) = lower(btrim(p_model)) and lower(btrim(v.name)) = lower(btrim(p_variant)) and not v.available_wholesale) then
    raise exception 'El producto ya no está disponible para Mayorista' using errcode = '22023';
  end if;
end $f$;

create trigger order_lines_write instead of insert or update or delete on public.order_lines
  for each row execute function private.order_lines_write();

create or replace function private.local_sales_write() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_row public.orders%rowtype;
begin
  perform private.require_internal_staff();
  if tg_op <> 'INSERT' then raise exception 'Las ventas registradas no se modifican desde aquí' using errcode = '42501'; end if;
  new.channel := coalesce(new.channel, 'Local');
  new.customer_name := coalesce(nullif(btrim(new.customer_name), ''), 'Cliente sin registrar');
  new.sold_on := coalesce(new.sold_on, current_date);
  if new.channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') then raise exception 'El canal no es válido' using errcode = '22023'; end if;
  if new.payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña') then raise exception 'La forma de pago no es válida' using errcode = '22023'; end if;
  if new.sold_on > current_date then raise exception 'La fecha de venta no es válida' using errcode = '22023'; end if;
  if new.total_minor is null or new.total_minor < 0 then raise exception 'El total no es válido' using errcode = '22023'; end if;
  insert into public.orders (status, items_subtotal_minor, total_minor, shipping_method, customer_snapshot, channel,
    customer_name, sold_on, payment_method, deposit_minor)
  values ('internal_completed', new.total_minor, new.total_minor, 'pickup',
    jsonb_strip_nulls(jsonb_build_object('purchaseFlow', 'internal', 'localCustomerId', new.customer_id, 'createdBy', coalesce(new.created_by, auth.uid()))),
    new.channel, new.customer_name, new.sold_on, new.payment_method, case when new.payment_method = 'Seña' then new.total_minor end)
  returning * into v_row;
  new.id := v_row.id; new.sale_number := v_row.order_number; new.reference_code := v_row.reference_code;
  new.created_at := v_row.created_at; new.currency := v_row.currency; new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $f$;

create trigger local_sales_write instead of insert or update or delete on public.local_sales
  for each row execute function private.local_sales_write();

create or replace function private.local_sale_items_write() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_channel text;
begin
  perform private.require_internal_staff();
  if tg_op = 'DELETE' then raise exception 'Los ítems de una venta no se eliminan desde aquí' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    update public.order_items set production_status = new.production_status,
      immutable_snapshot = case when new.customization is distinct from old.customization
        then immutable_snapshot || jsonb_build_object('customization', new.customization) else immutable_snapshot end
    where id = old.id;
    return new;
  end if;
  select channel into v_channel from public.orders where id = new.sale_id;
  if v_channel is null or v_channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') then
    raise exception 'La venta no existe' using errcode = '22023';
  end if;
  if not exists (select 1 from public.commerce_variants variant where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  if v_channel <> 'Local' and exists (select 1 from public.commerce_variants variant join public.commerce_products product on product.id = variant.product_id
      where variant.id = new.variant_id and coalesce(product.category_code, product.category) = 'servicios') then
    raise exception 'Los servicios solo se registran en Local' using errcode = '22023';
  end if;
  new.id := coalesce(new.id, gen_random_uuid());
  new.production_status := coalesce(new.production_status, 'pending');
  new.created_at := coalesce(new.created_at, now());
  new.line_total_minor := new.unit_price_minor * new.quantity;
  insert into public.order_items (id, order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
    immutable_snapshot, requires_review, created_at, production_status)
  values (new.id, new.sale_id, 'catalog', new.variant_id, new.sku, new.product_name || ' — ' || new.variant_name, new.quantity,
    new.unit_price_minor, new.line_total_minor,
    jsonb_build_object('source', 'local', 'productName', new.product_name, 'variantName', new.variant_name)
      || case when new.customization is not null then jsonb_build_object('customization', new.customization) else '{}'::jsonb end,
    false, new.created_at, new.production_status);
  return new;
end $f$;

create trigger local_sale_items_write instead of insert or update or delete on public.local_sale_items
  for each row execute function private.local_sale_items_write();

-- 9) Renombres de catálogo y de clientes: ahora actualizan order_items / orders.
create or replace function private.sync_variant_name_to_history() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_model text;
begin
  if new.name is distinct from old.name then
    select name into v_model from public.commerce_products where id = new.product_id;
    update public.order_items i set title = v_model || ' — ' || new.name,
      immutable_snapshot = case i.immutable_snapshot ->> 'source'
        when 'wholesale' then jsonb_set(i.immutable_snapshot, '{variant}', to_jsonb(new.name))
        when 'local' then jsonb_set(i.immutable_snapshot, '{variantName}', to_jsonb(new.name))
        else i.immutable_snapshot end
    where (i.immutable_snapshot ->> 'source' = 'wholesale' and i.immutable_snapshot ->> 'model' = v_model and i.immutable_snapshot ->> 'variant' = old.name)
       or (coalesce(i.immutable_snapshot ->> 'source', '') <> 'wholesale' and i.item_type = 'catalog' and i.source_variant_id = new.id);
  end if;
  return new;
end $f$;

create or replace function private.sync_product_name_to_history() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if new.name is distinct from old.name then
    update public.order_items i set
      title = new.name || ' — ' || coalesce(i.immutable_snapshot ->> 'variant', i.immutable_snapshot ->> 'variantName', v.name, split_part(i.title, ' — ', 2)),
      immutable_snapshot = case i.immutable_snapshot ->> 'source'
        when 'wholesale' then jsonb_set(i.immutable_snapshot, '{model}', to_jsonb(new.name))
        when 'local' then jsonb_set(i.immutable_snapshot, '{productName}', to_jsonb(new.name))
        else i.immutable_snapshot end
    from public.order_items i2 left join public.commerce_variants v on v.id = i2.source_variant_id
    where i2.id = i.id and (
      (i.immutable_snapshot ->> 'source' = 'wholesale' and i.immutable_snapshot ->> 'model' = old.name
        and (i.immutable_snapshot ->> 'variant' = 'Genérico'
             or i.immutable_snapshot ->> 'variant' in (select name from public.commerce_variants where product_id = new.id)))
      or (coalesce(i.immutable_snapshot ->> 'source', '') <> 'wholesale' and i.item_type = 'catalog'
          and i.source_variant_id in (select id from public.commerce_variants where product_id = new.id)));
  end if;
  return new;
end $f$;

create or replace function public.sync_wholesale_customer_name() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if new.full_name is distinct from old.full_name then
    update public.orders set customer_name = new.full_name where channel = 'Mayorista' and customer_name = old.full_name;
  end if;
  return new;
end $f$;

notify pgrst, 'reload schema';

-- 10) Verificación: conteos, códigos y totales contra las tablas originales; si algo no cuadra, se deshace todo.
do $$
declare r record;
begin
  select
    (select count(*) from public.orders where channel in ('Web', 'Mayorista web')) web,
    (select count(*) from public.local_sales) ventas, (select count(*) from private.legacy_local_sales_20261022) ventas_antes,
    (select count(*) from public.local_sale_items) items, (select count(*) from private.legacy_local_sale_items_20261022) items_antes,
    (select count(*) from public.order_lines) lineas, (select count(*) from private.legacy_order_lines_20261022) lineas_antes,
    (select count(distinct order_id) from public.order_lines) pedidos_may,
    (select count(*) from public.local_sales n join private.legacy_local_sales_20261022 a using (id)
       where (n.reference_code, n.channel, n.customer_name, n.total_minor, n.payment_method, n.sold_on, n.sale_number)
             is distinct from (a.reference_code, a.channel, a.customer_name, a.total_minor, a.payment_method, a.sold_on, a.sale_number)) ventas_distintas,
    (select count(*) from public.local_sale_items n join private.legacy_local_sale_items_20261022 a using (id)
       where (n.sale_id, n.variant_id, n.product_name, n.variant_name, n.quantity, n.unit_price_minor, n.line_total_minor, n.production_status)
             is distinct from (a.sale_id, a.variant_id, a.product_name, a.variant_name, a.quantity, a.unit_price_minor, a.line_total_minor, a.production_status)) items_distintos,
    (select count(*) from public.order_lines n join private.legacy_order_lines_20261022 a using (line_id)
       where (n.order_id, n.customer, n.model, n.variant, n.quantity, n.status, n.completed_at, n.unit_price_arg, n.unit_price_uyu,
              n.exchange_rate, n.total_arg, n.total_uyu, n.order_type, n.sale_channel)
             is distinct from (a.order_id, a.customer, a.model, a.variant, a.quantity, a.status, a.completed_at, a.unit_price_arg, a.unit_price_uyu,
              a.exchange_rate, a.total_arg, a.total_uyu, a.order_type, a.sale_channel)) lineas_distintas
  into r;
  if r.web <> 8 or r.ventas <> r.ventas_antes or r.items <> r.items_antes or r.lineas <> r.lineas_antes or r.pedidos_may <> 95
     or r.ventas_distintas <> 0 or r.items_distintos <> 0 or r.lineas_distintas <> 0 then
    raise exception 'La verificación no cuadra: %', row_to_json(r);
  end if;
  raise notice 'Verificación OK: %', row_to_json(r);
end $$;
