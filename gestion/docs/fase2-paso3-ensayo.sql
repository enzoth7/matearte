-- Fase 2, paso 3: mayoristas (customers) y agenda (local_sales_customers) pasan a una sola tabla public.contacts.
-- Las cuentas web (customer_profiles) y la newsletter siguen en sus tablas, enlazadas por usuario o email.
-- customers y local_sales_customers quedan como vistas compatibles con escritura (disparadores INSTEAD OF);
-- las tablas originales se conservan en private como respaldo. Los mayoristas con un único homónimo en la
-- agenda se fusionan con esa ficha (decisión de Enzo), salvo los que coinciden solo por nombre de pila
-- (Abigail, Anahí, Bautista, Masi y Yamil), que quedan separados: 10 fusiones. Todo en una transacción con verificación final.

-- 0) Guardas y foto previa de la vista de marketing (se reconstruye al final sobre la vista nueva).
do $$
begin
  if (select count(*) from public.customers) <> 45 or (select count(*) from public.local_sales_customers) <> 5697
     or to_regclass('public.contacts') is not null then
    raise exception 'El estado de partida no coincide con el relevado';
  end if;
end $$;
create temp table _paso3 on commit drop as
select pg_get_viewdef('public.marketing_contact_directory'::regclass) as directorio_def,
       (select count(*) from public.marketing_contact_directory) as directorio_filas;

-- 1) Tabla única de contactos.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  first_name text,
  last_name text,
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  additional_phones text[] not null default '{}',
  company_name text,
  address text,
  city text check (city is null or char_length(city) <= 120),
  country text check (country is null or char_length(country) <= 120),
  department text,
  postal_code text,
  birth_date date check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  notes text not null default '' check (char_length(notes) <= 2000),
  origin_channel text not null default 'Local' check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo','Suscripción','Suscripción con desc.')),
  customer_type text not null default 'Minorista' check (customer_type in ('Minorista','Mayorista')),
  inferred_category text,
  product_interest text,
  first_purchase_date date check (first_purchase_date is null or first_purchase_date <= current_date),
  last_purchase_date date check (last_purchase_date is null or last_purchase_date <= current_date),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  linked_customer_id text,
  agenda_import_key text,
  in_agenda boolean not null default true,
  wholesale_name text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_purchase_dates check (first_purchase_date is null or last_purchase_date is null or first_purchase_date <= last_purchase_date),
  constraint contacts_has_role check (in_agenda or wholesale_name is not null)
);
create unique index contacts_email_unique_idx on public.contacts (lower(email)) where email is not null and btrim(email) <> '';
create unique index contacts_agenda_import_key_idx on public.contacts (agenda_import_key) where agenda_import_key is not null;
create unique index contacts_linked_customer_id_idx on public.contacts (linked_customer_id) where linked_customer_id is not null;
create unique index contacts_wholesale_name_idx on public.contacts (wholesale_name) where wholesale_name is not null;
create index contacts_name_idx on public.contacts (lower(full_name) text_pattern_ops);
create index contacts_phone_idx on public.contacts (phone) where phone is not null and btrim(phone) <> '';
create index contacts_updated_at_id_idx on public.contacts (updated_at, id);
create index contacts_created_by_idx on public.contacts (created_by);
create trigger contacts_set_updated_at before update on public.contacts for each row execute function private.set_updated_at();

alter table public.contacts enable row level security;
create policy contacts_staff_read on public.contacts for select to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));
create policy contacts_staff_insert on public.contacts for insert to authenticated
  with check ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));
create policy contacts_staff_update on public.contacts for update to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
  with check ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));
create policy contacts_admin_delete on public.contacts for delete to authenticated using ((select private.is_commerce_admin()));
revoke all on public.contacts from public, anon;
grant select, insert, update, delete on public.contacts to authenticated;

-- 2) Agenda: cada ficha conserva su id.
insert into public.contacts (id, full_name, email, phone, additional_phones, company_name, address, city, country, department,
  postal_code, birth_date, notes, origin_channel, customer_type, inferred_category, product_interest, first_purchase_date,
  last_purchase_date, auth_user_id, linked_customer_id, agenda_import_key, in_agenda, created_by, created_at, updated_at)
select id, full_name, email, phone, agenda_additional_phones, company_name, address, city, country, department,
  postal_code, birth_date, notes, origin_channel, customer_type, agenda_inferred_category, product_interest, first_purchase_date,
  last_purchase_date, source_user_id, linked_customer_id, agenda_import_key, true, created_by, created_at, updated_at
from public.local_sales_customers;

-- 3) Mayoristas con un único homónimo en la agenda: se fusionan con esa ficha.
--    Quedan separados los que coinciden solo por nombre de pila, sin teléfono ni email para confirmar.
create temp table _fusion on commit drop as
with norm as (
  select c.full_name, lower(btrim(regexp_replace(translate(c.full_name, 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn'), '\s+', ' ', 'g'))) nk from public.customers c
  where c.full_name not in ('ABIGAIL', 'ANAHI', 'BAUTISTA', 'MASI', 'YAMIL')
), agenda as (
  select t.id, lower(btrim(regexp_replace(translate(t.full_name, 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn'), '\s+', ' ', 'g'))) nk from public.contacts t
)
select n.full_name, (array_agg(a.id))[1] as contact_id
from norm n join agenda a on a.nk = n.nk
group by n.full_name having count(*) = 1;

do $$ begin
  if (select count(*) from _fusion) <> 10 then raise exception 'Se esperaban 10 fusiones, hay %', (select count(*) from _fusion); end if;
end $$;

update public.contacts t set
  wholesale_name = cu.full_name,
  first_name = coalesce(t.first_name, cu.first_name), last_name = coalesce(t.last_name, cu.last_name),
  email = coalesce(nullif(btrim(t.email), ''), nullif(btrim(cu.email), '')), phone = coalesce(nullif(btrim(t.phone), ''), nullif(btrim(cu.phone), '')),
  additional_phones = array(select distinct unnest(t.additional_phones || cu.additional_phones)),
  company_name = coalesce(t.company_name, cu.company_name), address = coalesce(t.address, cu.address),
  city = coalesce(t.city, cu.city), country = coalesce(t.country, cu.country), department = coalesce(t.department, cu.department),
  postal_code = coalesce(t.postal_code, cu.postal_code), birth_date = coalesce(t.birth_date, cu.birth_date),
  notes = case when coalesce(btrim(cu.notes), '') = '' or cu.notes = t.notes then t.notes
               when t.notes = '' then cu.notes else left(t.notes || ' | ' || cu.notes, 2000) end,
  customer_type = cu.customer_type,
  inferred_category = coalesce(t.inferred_category, cu.inferred_category), product_interest = coalesce(t.product_interest, cu.product_interest),
  linked_customer_id = coalesce(t.linked_customer_id, 'wholesale:' || cu.full_name)
from _fusion f join public.customers cu on cu.full_name = f.full_name
where t.id = f.contact_id;

-- 4) El resto de los mayoristas, como contactos propios.
insert into public.contacts (full_name, first_name, last_name, email, phone, additional_phones, company_name, address, city, country,
  department, postal_code, birth_date, notes, origin_channel, customer_type, inferred_category, product_interest, in_agenda, wholesale_name, created_by)
select cu.full_name, cu.first_name, cu.last_name, nullif(btrim(cu.email), ''), nullif(btrim(cu.phone), ''), cu.additional_phones, cu.company_name,
  cu.address, cu.city, cu.country, cu.department, cu.postal_code, cu.birth_date, coalesce(cu.notes, ''), cu.origin_channel, cu.customer_type,
  cu.inferred_category, cu.product_interest, false, cu.full_name, null
from public.customers cu
where not exists (select 1 from public.contacts t where t.wholesale_name = cu.full_name);

-- 5) Pedidos internos enlazados a su contacto.
alter table public.orders add column contact_id uuid references public.contacts(id) on delete set null;
create index orders_contact_id_idx on public.orders (contact_id) where contact_id is not null;
alter table public.orders disable trigger orders_updated_at;
update public.orders o set contact_id = t.id
from public.contacts t
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook') and t.id = nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid;
update public.orders o set contact_id = t.id
from public.contacts t
where o.channel = 'Mayorista' and t.wholesale_name = o.customer_name;
alter table public.orders enable trigger orders_updated_at;

-- 6) Tablas originales a private como respaldo.
alter table public.customers set schema private;
alter table private.customers rename to legacy_customers_20261022;
alter table public.local_sales_customers set schema private;
alter table private.local_sales_customers rename to legacy_local_sales_customers_20261022;

-- 7) Vistas compatibles, con las mismas columnas.
create view public.customers with (security_invoker = true) as
select t.wholesale_name as full_name, t.first_name, t.last_name, t.phone, t.email, t.address, t.notes, t.company_name, t.birth_date,
  t.city, t.country, t.origin_channel, t.customer_type, t.department, t.postal_code, t.additional_phones, t.inferred_category, t.product_interest
from public.contacts t
where t.wholesale_name is not null;

create view public.local_sales_customers with (security_invoker = true) as
select t.id, t.full_name, t.email, t.phone, t.birth_date, t.first_purchase_date, t.last_purchase_date, t.auth_user_id as source_user_id,
  t.notes, t.created_by, t.created_at, t.updated_at, t.city, t.country, t.agenda_import_key,
  t.additional_phones as agenda_additional_phones, t.inferred_category as agenda_inferred_category, t.company_name, t.address,
  t.linked_customer_id, t.origin_channel, t.customer_type, t.department, t.postal_code, t.product_interest
from public.contacts t
where t.in_agenda;

revoke all on public.customers, public.local_sales_customers from public, anon;
grant select, insert, update, delete on public.customers, public.local_sales_customers to authenticated;

-- 8) Escritura sobre las vistas.
create or replace function private.customers_write() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_id uuid; v_agenda boolean;
begin
  perform private.require_internal_staff();
  if tg_op = 'INSERT' then
    if nullif(btrim(new.full_name), '') is null then raise exception 'Ingresá el nombre del cliente.' using errcode = '23502'; end if;
    if exists (select 1 from public.contacts where wholesale_name = new.full_name) then
      raise exception 'Ya existe un cliente mayorista con ese nombre' using errcode = '23505';
    end if;
    new.notes := coalesce(new.notes, ''); new.origin_channel := coalesce(new.origin_channel, 'WhatsApp');
    new.customer_type := coalesce(new.customer_type, 'Mayorista'); new.additional_phones := coalesce(new.additional_phones, '{}');
    insert into public.contacts (full_name, first_name, last_name, email, phone, additional_phones, company_name, address, city, country,
      department, postal_code, birth_date, notes, origin_channel, customer_type, inferred_category, product_interest, in_agenda, wholesale_name)
    values (new.full_name, new.first_name, new.last_name, nullif(btrim(new.email), ''), nullif(btrim(new.phone), ''), new.additional_phones,
      new.company_name, new.address, new.city, new.country, new.department, new.postal_code, new.birth_date, new.notes, new.origin_channel,
      new.customer_type, new.inferred_category, new.product_interest, false, new.full_name);
    return new;
  end if;

  select id, in_agenda into v_id, v_agenda from public.contacts where wholesale_name = old.full_name;
  if v_id is null then return null; end if;

  if tg_op = 'DELETE' then
    if exists (select 1 from public.orders where channel = 'Mayorista' and customer_name = old.full_name) then
      raise exception 'No se puede eliminar este cliente porque ya tiene pedidos vinculados.' using errcode = '23503';
    end if;
    if v_agenda then
      update public.contacts set wholesale_name = null,
        linked_customer_id = case when linked_customer_id = 'wholesale:' || old.full_name then null else linked_customer_id end
      where id = v_id;
    else
      delete from public.contacts where id = v_id;
    end if;
    return old;
  end if;

  if new.full_name is distinct from old.full_name then
    if nullif(btrim(new.full_name), '') is null then raise exception 'Ingresá el nombre del cliente.' using errcode = '23502'; end if;
    if exists (select 1 from public.contacts where wholesale_name = new.full_name and id <> v_id) then
      raise exception 'Ya existe un cliente mayorista con ese nombre' using errcode = '23505';
    end if;
  end if;
  update public.contacts set
    wholesale_name = new.full_name, full_name = case when in_agenda then full_name else new.full_name end,
    first_name = new.first_name, last_name = new.last_name, email = nullif(btrim(new.email), ''), phone = nullif(btrim(new.phone), ''),
    additional_phones = coalesce(new.additional_phones, '{}'), company_name = new.company_name, address = new.address, city = new.city,
    country = new.country, department = new.department, postal_code = new.postal_code, birth_date = new.birth_date,
    notes = coalesce(new.notes, ''), origin_channel = coalesce(new.origin_channel, origin_channel),
    customer_type = coalesce(new.customer_type, customer_type), inferred_category = new.inferred_category, product_interest = new.product_interest,
    linked_customer_id = case when linked_customer_id = 'wholesale:' || old.full_name then 'wholesale:' || new.full_name else linked_customer_id end
  where id = v_id;
  if new.full_name is distinct from old.full_name then
    update public.orders set customer_name = new.full_name where channel = 'Mayorista' and customer_name = old.full_name;
  end if;
  return new;
end $f$;

create trigger customers_write instead of insert or update or delete on public.customers
  for each row execute function private.customers_write();

create or replace function private.local_sales_customers_write() returns trigger language plpgsql security definer set search_path = '' as $f$
declare v_wholesale text;
begin
  perform private.require_internal_staff();
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid()); new.notes := coalesce(new.notes, '');
    new.origin_channel := coalesce(new.origin_channel, 'Local'); new.customer_type := coalesce(new.customer_type, 'Minorista');
    new.agenda_additional_phones := coalesce(new.agenda_additional_phones, '{}'); new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now()); new.updated_at := coalesce(new.updated_at, now());
    insert into public.contacts (id, full_name, email, phone, additional_phones, company_name, address, city, country, department,
      postal_code, birth_date, notes, origin_channel, customer_type, inferred_category, product_interest, first_purchase_date,
      last_purchase_date, auth_user_id, linked_customer_id, agenda_import_key, in_agenda, created_by, created_at, updated_at)
    values (new.id, new.full_name, new.email, new.phone, new.agenda_additional_phones, new.company_name, new.address, new.city, new.country,
      new.department, new.postal_code, new.birth_date, new.notes, new.origin_channel, new.customer_type, new.agenda_inferred_category,
      new.product_interest, new.first_purchase_date, new.last_purchase_date, new.source_user_id, new.linked_customer_id, new.agenda_import_key,
      true, new.created_by, new.created_at, new.updated_at);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.contacts set full_name = new.full_name, email = new.email, phone = new.phone,
      additional_phones = coalesce(new.agenda_additional_phones, '{}'), company_name = new.company_name, address = new.address,
      city = new.city, country = new.country, department = new.department, postal_code = new.postal_code, birth_date = new.birth_date,
      notes = coalesce(new.notes, ''), origin_channel = coalesce(new.origin_channel, origin_channel),
      customer_type = coalesce(new.customer_type, customer_type), inferred_category = new.agenda_inferred_category,
      product_interest = new.product_interest, first_purchase_date = new.first_purchase_date, last_purchase_date = new.last_purchase_date,
      auth_user_id = new.source_user_id, linked_customer_id = new.linked_customer_id, agenda_import_key = new.agenda_import_key
    where id = old.id and in_agenda
    returning updated_at into new.updated_at;
    return new;
  end if;

  if not (select private.is_commerce_admin()) then
    raise exception 'No tenés permiso para eliminar contactos.' using errcode = '42501';
  end if;
  select wholesale_name into v_wholesale from public.contacts where id = old.id;
  if v_wholesale is not null then
    update public.contacts set in_agenda = false where id = old.id;
  else
    delete from public.contacts where id = old.id;
  end if;
  return old;
end $f$;

create trigger local_sales_customers_write instead of insert or update or delete on public.local_sales_customers
  for each row execute function private.local_sales_customers_write();

-- 9) Los pedidos nuevos (venta local y mayorista) quedan enlazados a su contacto.
create or replace function private.wholesale_order_for(p_code text, p_customer text, p_sale_channel text, p_created_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $f$
declare v_order uuid;
begin
  if nullif(btrim(p_code), '') is null then raise exception 'Falta el número de pedido' using errcode = '22023'; end if;
  select id into v_order from public.orders where reference_code = p_code and channel = 'Mayorista' for update;
  if v_order is null then
    insert into public.orders (status, items_subtotal_minor, total_minor, shipping_method, customer_snapshot,
      reference_code, channel, customer_name, contact_id, sold_on, created_at)
    values ('internal_open', 0, 0, 'pickup', jsonb_build_object('purchaseFlow', 'internal', 'saleChannel', coalesce(p_sale_channel, 'WhatsApp')),
      p_code, 'Mayorista', p_customer, (select id from public.contacts where wholesale_name = p_customer),
      coalesce(p_created_at, now())::date, coalesce(p_created_at, now()))
    returning id into v_order;
  end if;
  return v_order;
end $f$;

-- Cuando una línea cambia de cliente, el pedido toma el contacto nuevo.
create or replace function private.sync_wholesale_order_contact() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if new.channel = 'Mayorista' and new.customer_name is distinct from old.customer_name then
    new.contact_id := (select id from public.contacts where wholesale_name = new.customer_name);
  end if;
  return new;
end $f$;
create trigger orders_sync_wholesale_contact before update of customer_name on public.orders
  for each row execute function private.sync_wholesale_order_contact();

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
    customer_name, contact_id, sold_on, payment_method, deposit_minor)
  values ('internal_completed', new.total_minor, new.total_minor, 'pickup',
    jsonb_strip_nulls(jsonb_build_object('purchaseFlow', 'internal', 'localCustomerId', new.customer_id, 'createdBy', coalesce(new.created_by, auth.uid()))),
    new.channel, new.customer_name, (select id from public.contacts where id = new.customer_id), new.sold_on, new.payment_method,
    case when new.payment_method = 'Seña' then new.total_minor end)
  returning * into v_row;
  new.id := v_row.id; new.sale_number := v_row.order_number; new.reference_code := v_row.reference_code;
  new.created_at := v_row.created_at; new.currency := v_row.currency; new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $f$;

-- 10) La vista de marketing vuelve a leer la agenda desde la vista nueva (mismo texto que antes).
do $$ begin
  execute 'create or replace view public.marketing_contact_directory as ' || (select directorio_def from _paso3);
end $$;

notify pgrst, 'reload schema';

-- 11) Verificación: si algo no cuadra, se deshace todo.
do $$
declare r record;
begin
  select
    (select count(*) from public.contacts) contactos,
    (select count(*) from public.contacts where in_agenda) agenda,
    (select count(*) from public.contacts where wholesale_name is not null) mayoristas,
    (select count(*) from public.contacts where in_agenda and wholesale_name is not null) fusionados,
    (select count(*) from public.local_sales_customers n join private.legacy_local_sales_customers_20261022 a using (id)
       where n.linked_customer_id is not distinct from a.linked_customer_id
         and (n.full_name, n.email, n.phone, n.birth_date, n.first_purchase_date, n.last_purchase_date, n.source_user_id, n.notes, n.created_by,
              n.created_at, n.city, n.country, n.agenda_import_key, n.agenda_additional_phones, n.agenda_inferred_category, n.company_name,
              n.address, n.origin_channel, n.customer_type, n.department, n.postal_code, n.product_interest)
             is not distinct from
             (a.full_name, a.email, a.phone, a.birth_date, a.first_purchase_date, a.last_purchase_date, a.source_user_id, a.notes, a.created_by,
              a.created_at, a.city, a.country, a.agenda_import_key, a.agenda_additional_phones, a.agenda_inferred_category, a.company_name,
              a.address, a.origin_channel, a.customer_type, a.department, a.postal_code, a.product_interest)) agenda_identica,
    (select count(*) from public.customers n join private.legacy_customers_20261022 a using (full_name)) mayoristas_por_nombre,
    (select count(*) from public.customers n join private.legacy_customers_20261022 a using (full_name)
       where not exists (select 1 from _fusion f where f.full_name = n.full_name)
         and (n.first_name, n.last_name, n.phone, n.email, n.address, n.notes, n.company_name, n.birth_date, n.city, n.country, n.origin_channel,
              n.customer_type, n.department, n.postal_code, n.additional_phones, n.inferred_category, n.product_interest)
             is not distinct from
             (a.first_name, a.last_name, nullif(btrim(a.phone), ''), nullif(btrim(a.email), ''), a.address, coalesce(a.notes, ''), a.company_name,
              a.birth_date, a.city, a.country, a.origin_channel, a.customer_type, a.department, a.postal_code, a.additional_phones,
              a.inferred_category, a.product_interest)) mayoristas_identicos,
    (select count(*) from public.orders where channel = 'Mayorista' and contact_id is null) mayoristas_sin_contacto,
    (select count(*) from public.orders where channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
       and customer_snapshot ? 'localCustomerId' and contact_id is null) ventas_sin_contacto,
    (select count(*) from public.marketing_contact_directory) directorio,
    (select directorio_filas from _paso3) directorio_antes
  into r;
  -- La agenda queda idéntica salvo las 10 fichas fusionadas; los 35 mayoristas sin fusionar quedan idénticos.
  if r.contactos <> 5732 or r.agenda <> 5697 or r.mayoristas <> 45 or r.fusionados <> 10 or r.agenda_identica <> 5687
     or r.mayoristas_por_nombre <> 45 or r.mayoristas_identicos <> 35 or r.mayoristas_sin_contacto <> 0 or r.ventas_sin_contacto <> 0
     or r.directorio <> r.directorio_antes then
    raise exception 'La verificación no cuadra: %', row_to_json(r);
  end if;
  raise notice 'Verificación OK: %', row_to_json(r);
end $$;
-- ENSAYO del paso 3. Pegar DESPUÉS del contenido completo de fase2-paso3.sql, en la misma ejecución.
-- Prueba escrituras como administrador y termina con un error a propósito: Supabase deshace todo, no queda nada aplicado.
-- El mensaje del error es el resultado del ensayo.
do $$
declare uid uuid; v_local uuid; v_tel text; v_borrados int; v_may int; v_merged uuid; v_masi_link text; v_order_contact uuid;
  v jsonb; v_sale_contact uuid; seq_last bigint; seq_called boolean; v_dir int; variant_local uuid; v_rename int;
begin
  select last_value, is_called into seq_last, seq_called from private.matearte_local_reference_seq;
  select user_id into uid from public.commerce_admin_users where active limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- agenda: alta, edición y baja por la función de gestión
  insert into public.local_sales_customers (full_name, phone, origin_channel) values ('Contacto Ensayo', '099000111', 'Local') returning id into v_local;
  update public.local_sales_customers set phone = '099000222' where id = v_local;
  select phone into v_tel from public.local_sales_customers where id = v_local;
  v_borrados := public.gestion_delete_unlinked_contact(v_local, null);
  -- mayorista: alta, renombre y baja
  insert into public.customers (full_name, first_name, last_name, phone, email, address, notes) values ('ENSAYO MAYORISTA', 'ENSAYO', 'MAYORISTA', '', '', '', '');
  update public.customers set full_name = 'ENSAYO MAYORISTA 2' where full_name = 'ENSAYO MAYORISTA';
  select count(*) into v_rename from public.customers where full_name = 'ENSAYO MAYORISTA 2';
  delete from public.customers where full_name = 'ENSAYO MAYORISTA 2';
  select count(*) into v_may from public.customers where full_name like 'ENSAYO MAYORISTA%';
  -- fusionado: TOBIAS CIROS aparece en las dos vistas y su pedido nuevo queda enlazado al mismo contacto
  select id, linked_customer_id into v_merged, v_masi_link from public.local_sales_customers where linked_customer_id = 'wholesale:TOBIAS CIROS';
  insert into public.order_lines (line_id, order_id, customer, model, variant, quantity, status, order_type, sale_channel, unit_price_arg, unit_price_uyu, exchange_rate, total_arg, total_uyu, created_at)
  values ('line-ensayo-tobias', '#M-ENSAYO3', 'TOBIAS CIROS', 'Criollo Coquito', 'Genérico', 1, 'Pendiente', 'normal', 'WhatsApp', 10500, 283.5, 0.027, 10500, 283.5, now());
  select contact_id into v_order_contact from public.orders where reference_code = '#M-ENSAYO3';
  -- venta local con cliente de la agenda
  select v2.id into variant_local from public.commerce_variants v2 join public.commerce_products p on p.id = v2.product_id
    where v2.active and v2.available_local and coalesce(p.category_code, p.category) <> 'servicios' order by v2.sku limit 1;
  v := public.gestion_create_local_sale_with_items(v_merged, current_date, 'Efectivo',
    jsonb_build_array(jsonb_build_object('variant_id', variant_local, 'quantity', 1, 'unit_price_minor', 100000)), null, 'Local');
  select contact_id into v_sale_contact from public.orders where id = (v ->> 'id')::uuid;
  reset role;
  -- La vista de marketing solo la leen las funciones del servidor: se cuenta con el rol de la base.
  select count(*) into v_dir from public.marketing_contact_directory;
  perform setval('private.matearte_local_reference_seq', seq_last, seq_called);
  raise exception 'ENSAYO PASO 3 OK, se deshace todo | agenda: tel=% borrados=% | mayorista: renombrado=% quedan=% | TOBIAS CIROS: link=% pedido_mismo_contacto=% venta_mismo_contacto=% | directorio=%',
    v_tel, v_borrados, v_rename, v_may, v_masi_link, (v_order_contact = v_merged), (v_sale_contact = v_merged), v_dir;
end $$;
