-- Genérico es una descripción del pedido, no una variante del catálogo.
-- Se vincula al primer SKU mayorista del producto; cuatro nombres históricos
-- de familias Fleje usan el diseño Liso como producto de referencia.
create or replace function private.wholesale_generic_reference_variant(p_model text)
returns table(variant_id uuid, sku text)
language sql
stable
set search_path = ''
as $$
  select variant.id, variant.sku::text
  from public.commerce_products as product
  join public.commerce_variants as variant on variant.product_id = product.id
  where lower(btrim(product.name)) = lower(btrim(case lower(btrim(p_model))
    when 'imperial cuero crudo fleje' then 'Mate Imperial Cuero Crudo Fleje Liso'
    when 'mate criollo imperial fleje con posa mate de cuero crudo' then 'Mate Criollo Imperial Fleje Liso Con Posa Mate de Cuero Crudo'
    when 'mate imperial fleje' then 'Mate Imperial Fleje Liso'
    when 'mate imperial fleje con pelos' then 'Mate Imperial Fleje Liso Pelos'
    else p_model
  end))
    and variant.available_wholesale is true
    and nullif(btrim(variant.sku), '') is not null
  order by case when variant.sku ~ '^[0-9]+$' then variant.sku::numeric end nulls last,
    variant.sku, variant.id
  limit 1;
$$;

revoke all on function private.wholesale_generic_reference_variant(text) from public, anon, authenticated;

create or replace function private.attach_generic_wholesale_reference_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_sku text;
begin
  if new.immutable_snapshot ->> 'source' is distinct from 'wholesale'
    or lower(btrim(coalesce(new.immutable_snapshot ->> 'variant', ''))) not in ('genérico', 'generico') then
    return new;
  end if;

  select reference.variant_id, reference.sku into v_variant_id, v_sku
  from private.wholesale_generic_reference_variant(new.immutable_snapshot ->> 'model') as reference;
  if v_variant_id is null then
    raise exception 'No se encontró una variante mayorista para el producto genérico %', new.immutable_snapshot ->> 'model'
      using errcode = '23503';
  end if;

  new.source_variant_id := v_variant_id;
  new.sku := v_sku;
  return new;
end;
$$;

revoke all on function private.attach_generic_wholesale_reference_variant() from public, anon, authenticated;

drop trigger if exists order_items_generic_wholesale_reference on public.order_items;
create trigger order_items_generic_wholesale_reference
before insert or update of source_variant_id, sku, immutable_snapshot on public.order_items
for each row execute function private.attach_generic_wholesale_reference_variant();

do $$
begin
  if exists (
    select 1 from public.order_items as item
    where item.immutable_snapshot ->> 'source' = 'wholesale'
      and lower(btrim(coalesce(item.immutable_snapshot ->> 'variant', ''))) in ('genérico', 'generico')
      and not exists (
        select 1 from private.wholesale_generic_reference_variant(item.immutable_snapshot ->> 'model')
      )
  ) then
    raise exception 'Hay líneas mayoristas genéricas sin un producto de referencia en el catálogo';
  end if;
end;
$$;

with generic_references as (
  select item.id, reference.variant_id, reference.sku
  from public.order_items as item
  cross join lateral private.wholesale_generic_reference_variant(item.immutable_snapshot ->> 'model') as reference
  where item.immutable_snapshot ->> 'source' = 'wholesale'
    and lower(btrim(coalesce(item.immutable_snapshot ->> 'variant', ''))) in ('genérico', 'generico')
)
update public.order_items as item
set source_variant_id = reference.variant_id,
    sku = reference.sku
from generic_references as reference
where item.id = reference.id
  and (item.source_variant_id, item.sku) is distinct from (reference.variant_id, reference.sku);
