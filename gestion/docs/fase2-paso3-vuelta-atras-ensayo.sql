-- Vuelta atrás del paso 3 (contactos). Usar solo si algo falla después de aplicar fase2-paso3.sql.
-- Devuelve customers y local_sales_customers a tablas, con todo lo cargado o editado después de la migración,
-- quita orders.contact_id y elimina public.contacts. Todo en una transacción con verificación final.
-- Límite conocido: si se renombró un cliente mayorista después del paso 3, la ficha vieja queda con el nombre
-- anterior cuando tiene líneas en el respaldo de pedidos; la ficha con el nombre nuevo se agrega igual.

-- 0) Guardas y foto previa.
do $$
begin
  if to_regclass('public.contacts') is null
     or to_regclass('private.legacy_local_sales_customers_20261022') is null
     or to_regclass('private.legacy_customers_20261022') is null then
    raise exception 'No se encuentra el estado del paso 3';
  end if;
end $$;
create temp table _vuelta3 on commit drop as
select pg_get_viewdef('public.marketing_contact_directory'::regclass) as directorio_def,
       (select count(*) from public.marketing_contact_directory) as directorio_filas,
       (select count(*) from public.contacts where in_agenda) as agenda,
       (select count(*) from public.contacts where wholesale_name is not null) as mayoristas;

-- 1) La agenda original recibe lo cargado, editado o borrado después del paso 3.
alter table private.legacy_local_sales_customers_20261022 disable trigger user;
update private.legacy_local_sales_customers_20261022 a set
  full_name = t.full_name, email = t.email, phone = t.phone, birth_date = t.birth_date,
  first_purchase_date = t.first_purchase_date, last_purchase_date = t.last_purchase_date, source_user_id = t.auth_user_id,
  notes = t.notes, created_by = t.created_by, created_at = t.created_at, updated_at = t.updated_at, city = t.city, country = t.country,
  agenda_import_key = t.agenda_import_key, agenda_additional_phones = t.additional_phones, agenda_inferred_category = t.inferred_category,
  company_name = t.company_name, address = t.address, linked_customer_id = t.linked_customer_id, origin_channel = t.origin_channel,
  customer_type = t.customer_type, department = t.department, postal_code = t.postal_code, product_interest = t.product_interest
from public.contacts t
where t.id = a.id and t.in_agenda;
delete from private.legacy_local_sales_customers_20261022 a
where not exists (select 1 from public.contacts t where t.id = a.id and t.in_agenda);
insert into private.legacy_local_sales_customers_20261022 (id, full_name, email, phone, birth_date, first_purchase_date, last_purchase_date,
  source_user_id, notes, created_by, created_at, updated_at, city, country, agenda_import_key, agenda_additional_phones,
  agenda_inferred_category, company_name, address, linked_customer_id, origin_channel, customer_type, department, postal_code, product_interest)
select t.id, t.full_name, t.email, t.phone, t.birth_date, t.first_purchase_date, t.last_purchase_date,
  t.auth_user_id, t.notes, t.created_by, t.created_at, t.updated_at, t.city, t.country, t.agenda_import_key, t.additional_phones,
  t.inferred_category, t.company_name, t.address, t.linked_customer_id, t.origin_channel, t.customer_type, t.department, t.postal_code, t.product_interest
from public.contacts t
where t.in_agenda and not exists (select 1 from private.legacy_local_sales_customers_20261022 a where a.id = t.id);
alter table private.legacy_local_sales_customers_20261022 enable trigger user;

-- 2) Los mayoristas originales reciben lo cargado o editado después del paso 3.
alter table private.legacy_customers_20261022 disable trigger user;
update private.legacy_customers_20261022 c set
  first_name = t.first_name, last_name = t.last_name, phone = t.phone, email = t.email, address = t.address, notes = t.notes,
  company_name = t.company_name, birth_date = t.birth_date, city = t.city, country = t.country, origin_channel = t.origin_channel,
  customer_type = t.customer_type, department = t.department, postal_code = t.postal_code, additional_phones = t.additional_phones,
  inferred_category = t.inferred_category, product_interest = t.product_interest
from public.contacts t
where t.wholesale_name = c.full_name;
insert into private.legacy_customers_20261022 (full_name, first_name, last_name, phone, email, address, notes, company_name, birth_date,
  city, country, origin_channel, customer_type, department, postal_code, additional_phones, inferred_category, product_interest)
select t.wholesale_name, t.first_name, t.last_name, t.phone, t.email, t.address, t.notes, t.company_name, t.birth_date,
  t.city, t.country, t.origin_channel, t.customer_type, t.department, t.postal_code, t.additional_phones, t.inferred_category, t.product_interest
from public.contacts t
where t.wholesale_name is not null and not exists (select 1 from private.legacy_customers_20261022 c where c.full_name = t.wholesale_name);
delete from private.legacy_customers_20261022 c
where not exists (select 1 from public.contacts t where t.wholesale_name = c.full_name)
  and not exists (select 1 from private.legacy_order_lines_20261022 l where l.customer = c.full_name);
alter table private.legacy_customers_20261022 enable trigger user;

-- 3) Pedidos sin contact_id y funciones de escritura como quedaron en el paso 2b.
drop trigger if exists orders_sync_wholesale_contact on public.orders;
drop function if exists private.sync_wholesale_order_contact();

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

alter table public.orders drop column contact_id;

-- 4) Vistas fuera, tablas de vuelta a public; la vista de marketing vuelve a leer la tabla.
alter view public.local_sales_customers rename to local_sales_customers_contactos_tmp;
alter view public.customers rename to customers_contactos_tmp;
alter table private.legacy_local_sales_customers_20261022 rename to local_sales_customers;
alter table private.local_sales_customers set schema public;
alter table private.legacy_customers_20261022 rename to customers;
alter table private.customers set schema public;
do $$ begin
  execute 'create or replace view public.marketing_contact_directory as ' || (select directorio_def from _vuelta3);
end $$;
drop view public.local_sales_customers_contactos_tmp;
drop view public.customers_contactos_tmp;
drop function if exists private.customers_write();
drop function if exists private.local_sales_customers_write();
drop table public.contacts;

notify pgrst, 'reload schema';

-- 5) Verificación.
do $$
declare r record;
begin
  select
    (select relkind::text from pg_class where relname = 'local_sales_customers' and relnamespace = 'public'::regnamespace) agenda_es,
    (select relkind::text from pg_class where relname = 'customers' and relnamespace = 'public'::regnamespace) mayoristas_es,
    (select count(*) from public.local_sales_customers) agenda, (select agenda from _vuelta3) agenda_antes,
    (select count(*) from public.customers) mayoristas, (select mayoristas from _vuelta3) mayoristas_antes,
    (select count(*) from public.marketing_contact_directory) directorio, (select directorio_filas from _vuelta3) directorio_antes,
    (select count(*) from public.orders o where o.channel = 'Mayorista' and not exists (select 1 from public.customers c where c.full_name = o.customer_name)) pedidos_sin_cliente,
    to_regclass('public.contacts') is null contactos_eliminado
  into r;
  if r.agenda_es <> 'r' or r.mayoristas_es <> 'r' or r.agenda <> r.agenda_antes or r.mayoristas < r.mayoristas_antes
     or r.directorio <> r.directorio_antes or r.pedidos_sin_cliente <> 0 or not r.contactos_eliminado then
    raise exception 'La verificación no cuadra: %', row_to_json(r);
  end if;
  raise notice 'Vuelta atrás OK: %', row_to_json(r);
end $$;

-- ENSAYO: si se llega acá, la vuelta atrás funcionó; este error deshace todo.
do $$ begin raise exception 'ENSAYO VUELTA ATRAS PASO 3 OK, se deshace todo: agenda=% mayoristas=% directorio=%', (select count(*) from public.local_sales_customers), (select count(*) from public.customers), (select count(*) from public.marketing_contact_directory); end $$;
