-- A single editable catalog can publish the same item in Local, Web and
-- Mayorista while the legacy wholesale tables remain compatible for the last
-- week of the old dashboard. Historical quantities are never recalculated.

alter table public.commerce_variants
  add column if not exists available_wholesale boolean not null default false,
  add column if not exists legacy_product_id text references public.products(id) on delete set null,
  add column if not exists wholesale_price_arg numeric;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commerce_variants_wholesale_price_arg_positive'
      and conrelid = 'public.commerce_variants'::regclass
  ) then
    alter table public.commerce_variants
      add constraint commerce_variants_wholesale_price_arg_positive
      check (wholesale_price_arg is null or wholesale_price_arg > 0);
  end if;
end $$;

create unique index if not exists commerce_variants_legacy_product_unique
  on public.commerce_variants (legacy_product_id)
  where legacy_product_id is not null;

alter table public.products
  add column if not exists available_local boolean not null default false,
  add column if not exists available_web boolean not null default false,
  add column if not exists commerce_product_id uuid references public.commerce_products(id) on delete set null,
  add column if not exists commerce_variant_id uuid references public.commerce_variants(id) on delete set null,
  add column if not exists image_path text,
  add column if not exists image_crop jsonb not null default '{}'::jsonb;

create unique index if not exists products_commerce_variant_unique
  on public.products (commerce_variant_id)
  where commerce_variant_id is not null;

insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values ('material-mate', 'Material del mate', 'enum', null, 'select', true, 15)
on conflict (code) do update set
  label_es = excluded.label_es,
  data_type = excluded.data_type,
  unit = excluded.unit,
  input_style = excluded.input_style,
  active = true,
  sort_order = excluded.sort_order;

insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('material-mate', 'calabaza', 'Calabaza', null, true, 10),
  ('material-mate', 'ceramica', 'Cerámica', null, true, 20),
  ('material-mate', 'madera', 'Madera', null, true, 30),
  ('material-mate', 'acero-inoxidable', 'Acero inoxidable', null, true, 40)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  active = true,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('mates', 'material-mate', 'product', true, true, 15),
  ('mates-personalizados', 'material-mate', 'product', true, true, 15)
on conflict (category_code, attribute_code, scope) do update set
  required = true,
  filterable = true,
  sort_order = excluded.sort_order;

-- Give each still-unlinked wholesale row its own commerce product. This is a
-- one-to-one compatibility link, not a merge with any existing retail item.
-- The historical rows do not have every new mate attribute. Import them as
-- incomplete drafts; the editor requires real values when they are updated.
drop trigger if exists validate_mate_product_identity on public.commerce_products;
drop trigger if exists apply_mate_product_identity_to_variant on public.commerce_variants;
do $$
declare
  legacy public.products%rowtype;
  new_product_id uuid;
  new_variant_id uuid;
  category_value text;
begin
  for legacy in
    select * from public.products
    where commerce_variant_id is null
    order by id
  loop
    category_value := coalesce(nullif(legacy.category_code, ''), 'otros');

    insert into public.commerce_products
      (editorial_slug, name, category, category_code, description, sale_mode,
       published, peso, catalog_filters, attributes)
    values
      ('mayorista-' || regexp_replace(lower(legacy.id), '[^a-z0-9]+', '-', 'g'),
       concat_ws(' · ', legacy.model, nullif(legacy.variant, '')), category_value, legacy.category_code, coalesce(legacy.description, ''),
       'standard', legacy.available_web, coalesce(legacy.weight_grams, 0),
       '{"colors":[],"finishes":[],"materials":[],"productTypes":[]}'::jsonb,
       coalesce(legacy.catalog_attributes, '{}'::jsonb))
    returning id into new_product_id;

    insert into public.commerce_variants
      (product_id, sku, name, base_price_minor, price_minor, currency, active,
       weight_grams, option_values, rim_type, leather_type,
       available_local, available_web, available_wholesale, legacy_product_id,
       wholesale_price_arg)
    values
      (new_product_id, coalesce(nullif(legacy.sku, ''), 'MAY-' || legacy.id),
       'Sin color', round(legacy.price_uyu * 100)::bigint,
       round(legacy.price_uyu * 100)::bigint, 'UYU', true, legacy.weight_grams,
       '{}'::jsonb, coalesce(legacy.rim_type, ''), coalesce(legacy.leather_type, ''),
       legacy.available_local, legacy.available_web, legacy.available_wholesale, legacy.id,
       legacy.price_arg)
    returning id into new_variant_id;

    update public.products
    set commerce_product_id = new_product_id,
        commerce_variant_id = new_variant_id
    where id = legacy.id;

    insert into public.commerce_product_images
      (product_id, storage_path, original_name, alt_text, mime_type, byte_size,
       sort_order, variant_id, option_values)
    select new_product_id, image.storage_path, image.original_name,
      image.alt_text, image.mime_type, image.byte_size, image.sort_order,
      null, image.option_values
    from public.wholesale_product_images image
    where image.product_id = legacy.id;
  end loop;
end $$;

-- A database already running the later color-only migration needs its
-- validators restored here. In a fresh replay that migration creates them.
do $$ begin
  if to_regprocedure('private.validate_mate_product_identity()') is not null then
    execute 'create trigger validate_mate_product_identity before insert or update of category_code, attributes on public.commerce_products for each row execute function private.validate_mate_product_identity()';
  end if;
  if to_regprocedure('private.validate_mate_catalog_variant()') is not null then
    execute 'create trigger apply_mate_product_identity_to_variant before insert or update of product_id, rim_type, leather_type on public.commerce_variants for each row execute function private.validate_mate_catalog_variant()';
  end if;
end $$;

create or replace function private.next_legacy_product_id()
returns text language sql security definer set search_path = '' as $$
  select (coalesce(max(case when id ~ '^[0-9]+$' then id::bigint end), 0) + 1)::text
  from public.products;
$$;

create or replace function private.sync_catalog_variant_to_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  product_row public.commerce_products%rowtype;
  previous_model text;
  previous_variant text;
  legacy_id text;
  rate numeric;
begin
  select * into product_row from public.commerce_products where id = new.product_id;
  legacy_id := new.legacy_product_id;
  if tg_op = 'UPDATE' then
    legacy_id := coalesce(legacy_id, old.legacy_product_id);
  end if;

  if legacy_id is null and new.available_wholesale then
    perform pg_advisory_xact_lock(19102026);
    legacy_id := private.next_legacy_product_id();
    select exchange_rate into rate from public.settings where id = 1;
    insert into public.products
      (id, model, variant, rim_type, leather_type, price_arg, price_uyu,
       category_code, description, sku, weight_grams, available_local,
       available_web, available_wholesale, catalog_attributes,
       commerce_product_id)
    values
      (legacy_id, product_row.name, new.name, coalesce(new.rim_type, ''),
       coalesce(new.leather_type, ''),
       coalesce(new.wholesale_price_arg,
         case when coalesce(rate, 0) > 0 then (new.base_price_minor::numeric / 100) / rate else 0 end),
       new.base_price_minor::numeric / 100, product_row.category_code,
       product_row.description, new.sku, new.weight_grams, new.available_local,
       new.available_web, true, product_row.attributes, product_row.id);
    new.legacy_product_id := legacy_id;
    return new;
  end if;

  if legacy_id is not null then
    select model, variant into previous_model, previous_variant
    from public.products where id = legacy_id;
    select exchange_rate into rate from public.settings where id = 1;

    update public.products set
      model = product_row.name,
      variant = new.name,
      rim_type = coalesce(new.rim_type, ''),
      leather_type = coalesce(new.leather_type, ''),
      price_arg = coalesce(new.wholesale_price_arg,
        case when coalesce(rate, 0) > 0 then (new.base_price_minor::numeric / 100) / rate else price_arg end),
      price_uyu = new.base_price_minor::numeric / 100,
      category_code = product_row.category_code,
      description = product_row.description,
      sku = new.sku,
      weight_grams = new.weight_grams,
      available_local = new.available_local,
      available_web = new.available_web,
      available_wholesale = new.available_wholesale,
      catalog_attributes = product_row.attributes,
      commerce_product_id = product_row.id,
      commerce_variant_id = new.id
    where id = legacy_id;

    if previous_model is distinct from product_row.name
       or previous_variant is distinct from new.name then
      update public.order_lines
      set model = product_row.name, variant = new.name
      where model = previous_model and variant = previous_variant;
    end if;

    if tg_op = 'UPDATE' and old.name is distinct from new.name then
      update public.local_sale_items
      set variant_name = new.name
      where variant_id = new.id;

      update public.order_items
      set title = product_row.name || ' — ' || new.name
      where item_type = 'catalog'
        and source_variant_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_variant_to_legacy on public.commerce_variants;
create trigger sync_catalog_variant_to_legacy
before insert or update of name, sku, base_price_minor, wholesale_price_arg, weight_grams, rim_type,
  leather_type, available_local, available_web, available_wholesale
on public.commerce_variants for each row
execute function private.sync_catalog_variant_to_legacy();

create or replace function private.link_catalog_variant_to_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.legacy_product_id is not null then
    update public.products
    set commerce_product_id = new.product_id,
        commerce_variant_id = new.id
    where id = new.legacy_product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists link_catalog_variant_to_legacy on public.commerce_variants;
create trigger link_catalog_variant_to_legacy
after insert or update of legacy_product_id, product_id
on public.commerce_variants for each row
execute function private.link_catalog_variant_to_legacy();

create or replace function private.sync_catalog_product_name_to_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.products
  set model = new.name,
      category_code = new.category_code,
      description = new.description,
      catalog_attributes = new.attributes
  where commerce_product_id = new.id;

  if old.name is distinct from new.name then
    update public.order_lines line
    set model = new.name
    where line.model = old.name
      and exists (
        select 1 from public.products product
        where product.commerce_product_id = new.id
          and product.variant = line.variant
      );

    update public.local_sale_items item
    set product_name = new.name
    where exists (
      select 1
      from public.commerce_variants variant
      where variant.product_id = new.id
        and variant.id = item.variant_id
    );

    update public.order_items item
    set title = new.name || ' — ' || variant.name
    from public.commerce_variants variant
    where item.item_type = 'catalog'
      and item.source_variant_id = variant.id
      and variant.product_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_product_name_to_legacy on public.commerce_products;
create trigger sync_catalog_product_name_to_legacy
after update of name, category_code, description, attributes
on public.commerce_products for each row
execute function private.sync_catalog_product_name_to_legacy();

create or replace function private.refresh_legacy_product_cover(p_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cover_path text;
  cover_values jsonb;
begin
  select image.storage_path, image.option_values
  into cover_path, cover_values
  from public.commerce_product_images image
  where image.product_id = p_product_id
  order by image.sort_order, image.created_at, image.id
  limit 1;

  update public.products
  set image_path = cover_path,
      image_crop = coalesce(cover_values, '{}'::jsonb)
  where commerce_product_id = p_product_id;
end;
$$;

create or replace function private.sync_catalog_cover_to_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_legacy_product_cover(old.product_id);
    return old;
  end if;
  perform private.refresh_legacy_product_cover(new.product_id);
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform private.refresh_legacy_product_cover(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_cover_to_legacy on public.commerce_product_images;
create trigger sync_catalog_cover_to_legacy
after insert or update or delete on public.commerce_product_images
for each row execute function private.sync_catalog_cover_to_legacy();

do $$
declare
  item record;
begin
  for item in select distinct commerce_product_id from public.products where commerce_product_id is not null
  loop
    perform private.refresh_legacy_product_cover(item.commerce_product_id);
  end loop;
end $$;

comment on column public.commerce_variants.available_wholesale is
  'True when the same purchasable catalog item is offered through Mayorista.';
comment on column public.commerce_variants.legacy_product_id is
  'Compatibility link to the final-week wholesale dashboard; not a product merge.';
comment on column public.commerce_variants.wholesale_price_arg is
  'Editable wholesale ARS price, independent of the UYU base price.';
