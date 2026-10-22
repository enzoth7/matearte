-- Vuelta atrás del paso 2b. Usar solo si algo falla después de aplicar fase2-paso2b.sql.
-- Devuelve local_sales, local_sale_items y order_lines a tablas, incluyendo lo que se haya cargado
-- después de la migración, y saca de orders los pedidos internos. Todo en una transacción.

-- 1) Lo cargado después de la migración vuelve a las tablas originales, sin regenerar códigos.
alter table private.legacy_local_sales_20261022 disable trigger user;
alter table private.legacy_local_sale_items_20261022 disable trigger user;
alter table private.legacy_order_lines_20261022 disable trigger user;

insert into private.legacy_local_sales_20261022 (id, customer_id, customer_name, sold_on, payment_method, total_minor, currency, created_by, created_at, reference_code, channel)
select v.id, v.customer_id, v.customer_name, v.sold_on, v.payment_method, v.total_minor, v.currency, v.created_by, v.created_at, v.reference_code, v.channel
from public.local_sales v
where not exists (select 1 from private.legacy_local_sales_20261022 a where a.id = v.id);

insert into private.legacy_local_sale_items_20261022 (id, sale_id, variant_id, sku, product_name, variant_name, quantity, unit_price_minor, created_at, production_status, customization)
select v.id, v.sale_id, v.variant_id, v.sku, v.product_name, v.variant_name, v.quantity, v.unit_price_minor, v.created_at, v.production_status, v.customization
from public.local_sale_items v
where not exists (select 1 from private.legacy_local_sale_items_20261022 a where a.id = v.id);

-- Las líneas que ya existían se actualizan con su último estado; las nuevas se insertan.
update private.legacy_order_lines_20261022 a set order_id = v.order_id, customer = v.customer, model = v.model, variant = v.variant,
  quantity = v.quantity, status = v.status, completed_at = v.completed_at, unit_price_arg = v.unit_price_arg, unit_price_uyu = v.unit_price_uyu,
  exchange_rate = v.exchange_rate, total_arg = v.total_arg, total_uyu = v.total_uyu, order_type = v.order_type, sale_channel = v.sale_channel
from public.order_lines v where v.line_id = a.line_id;
delete from private.legacy_order_lines_20261022 a where not exists (select 1 from public.order_lines v where v.line_id = a.line_id);
insert into private.legacy_order_lines_20261022 (line_id, order_id, customer, model, variant, quantity, status, created_at, completed_at,
  unit_price_arg, unit_price_uyu, exchange_rate, total_arg, total_uyu, order_type, sale_channel)
select v.line_id, v.order_id, v.customer, v.model, v.variant, v.quantity, v.status, v.created_at, v.completed_at,
  v.unit_price_arg, v.unit_price_uyu, v.exchange_rate, v.total_arg, v.total_uyu, v.order_type, v.sale_channel
from public.order_lines v
where not exists (select 1 from private.legacy_order_lines_20261022 a where a.line_id = v.line_id);

alter table private.legacy_local_sales_20261022 enable trigger user;
alter table private.legacy_local_sale_items_20261022 enable trigger user;
alter table private.legacy_order_lines_20261022 enable trigger user;

-- 2) Vistas fuera, tablas de vuelta a public con su nombre.
drop view public.order_lines, public.local_sale_items, public.local_sales;
alter table private.legacy_local_sales_20261022 rename to local_sales;
alter table private.local_sales set schema public;
alter table private.legacy_local_sale_items_20261022 rename to local_sale_items;
alter table private.local_sale_items set schema public;
alter table private.legacy_order_lines_20261022 rename to order_lines;
alter table private.order_lines set schema public;

-- 3) Pedidos internos fuera de orders.
delete from public.order_items where order_id in (select id from public.orders where channel not in ('Web', 'Mayorista web'));
delete from public.orders where channel not in ('Web', 'Mayorista web');

-- 4) Funciones y permisos como antes del 2b.
drop policy if exists orders_internal_staff_read on public.orders;
drop policy if exists order_items_internal_staff_read on public.order_items;
drop function if exists private.order_lines_write();
drop function if exists private.local_sales_write();
drop function if exists private.local_sale_items_write();
drop function if exists private.wholesale_order_for(text, text, text, timestamptz);
drop function if exists private.refresh_wholesale_order(uuid);
drop function if exists private.assert_wholesale_line_available(text, text);
drop function if exists private.require_internal_staff();

create or replace function public.sync_wholesale_customer_name() returns trigger language plpgsql set search_path to 'public' as $f$
begin
  if new.full_name is distinct from old.full_name then
    update public.order_lines set customer = new.full_name where customer = old.full_name;
  end if;
  return new;
end $f$;

create or replace function private.sync_variant_name_to_history() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_model text;
begin
  if new.name is distinct from old.name then
    select name into v_model from public.commerce_products where id = new.product_id;
    update public.order_lines set variant = new.name where model = v_model and variant = old.name;
    update public.local_sale_items set variant_name = new.name where variant_id = new.id;
    update public.order_items set title = v_model || ' — ' || new.name where item_type = 'catalog' and source_variant_id = new.id;
  end if;
  return new;
end $f$;

create or replace function private.sync_product_name_to_history() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if new.name is distinct from old.name then
    update public.order_lines set model = new.name
      where model = old.name and (variant = 'Genérico' or variant in (select name from public.commerce_variants where product_id = new.id));
    update public.local_sale_items set product_name = new.name
      where variant_id in (select id from public.commerce_variants where product_id = new.id);
    update public.order_items item set title = new.name || ' — ' || v.name
      from public.commerce_variants v
      where item.item_type = 'catalog' and item.source_variant_id = v.id and v.product_id = new.id;
  end if;
  return new;
end $f$;

notify pgrst, 'reload schema';

-- 5) Verificación: tablas de vuelta y sin pedidos internos.
select (select relkind::text from pg_class where relname = 'order_lines' and relnamespace = 'public'::regnamespace) order_lines_es,
       (select count(*) from public.order_lines) lineas, (select count(*) from public.local_sales) ventas,
       (select count(*) from public.orders where channel not in ('Web', 'Mayorista web')) internos;
