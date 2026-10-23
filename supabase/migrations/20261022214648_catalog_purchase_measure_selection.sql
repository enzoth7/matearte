-- A product characteristic may require a concrete choice at purchase time.
-- Commercial variants continue to represent only color.
alter table public.commerce_category_attributes
  add column if not exists purchase_selectable boolean not null default false;

update public.commerce_category_attributes
set purchase_selectable = true
where scope = 'product'
  and (category_code, attribute_code) in (
    ('mates', 'tamano'),
    ('botas', 'talle'),
    ('bombillas', 'largo-mm'),
    ('cintos', 'largo-cinto-cm')
  );

-- The product value wins when old variant data disagrees with it.
-- In particular, Imperial Colección Estribo remains mediano.
-- Legacy mates lack newer identity fields. Suspend those two identity triggers
-- only for this backfill, then restore them before changing variant data.
alter table public.commerce_products disable trigger validate_mate_product_identity;
alter table public.commerce_products disable trigger propagate_mate_product_identity;

update public.commerce_products p
set attributes = jsonb_set(coalesce(p.attributes, '{}'::jsonb), '{tamano}', '"todos"'::jsonb, true)
where coalesce(p.category_code, p.category) in ('mates', 'personalizados')
  and nullif(p.attributes->>'tamano', '') is null
  and exists (
    select 1 from public.commerce_variants v
    where v.product_id = p.id and v.option_values->>'tamano' = 'todos'
  );

update public.commerce_products p
set attributes = jsonb_set(coalesce(p.attributes, '{}'::jsonb), '{talle}', '"todos"'::jsonb, true)
where coalesce(p.category_code, p.category) = 'botas'
  and nullif(p.attributes->>'talle', '') is null
  and exists (
    select 1 from public.commerce_variants v
    where v.product_id = p.id and v.option_values->>'talle' = 'todos'
  );

alter table public.commerce_products enable trigger propagate_mate_product_identity;
alter table public.commerce_products enable trigger validate_mate_product_identity;

update public.commerce_variants v
set option_values = case
  when coalesce(v.option_values->>'color', v.color) is null then '{}'::jsonb
  else jsonb_build_object('color', coalesce(v.option_values->>'color', v.color))
end
where v.option_values ?| array['tamano', 'talle']
   or (v.color is not null and not (v.option_values ? 'color'));

-- A numeric legacy value is not one of the configured bombilla lengths.
update public.commerce_products p
set attributes = p.attributes - 'largo-mm'
where coalesce(p.category_code, p.category) = 'bombillas'
  and p.attributes ? 'largo-mm'
  and not exists (
    select 1 from public.commerce_attribute_options o
    where o.attribute_code = 'largo-mm'
      and o.code = p.attributes->>'largo-mm'
      and o.active
  );

-- Keep local sale intact. The web channel can be re-enabled after Gestión
-- has a valid product-level length.
update public.commerce_variants v
set available_web = false
from public.commerce_products p
where v.product_id = p.id
  and p.published
  and (
    (coalesce(p.category_code, p.category) = 'bombillas' and not exists (
      select 1 from public.commerce_attribute_options o
      where o.attribute_code = 'largo-mm'
        and o.code = p.attributes->>'largo-mm'
        and o.active
    ))
    or (coalesce(p.category_code, p.category) = 'cintos' and not exists (
      select 1 from public.commerce_attribute_options o
      where o.attribute_code = 'largo-cinto-cm'
        and o.code = p.attributes->>'largo-cinto-cm'
        and o.active
    ))
  );

update public.commerce_products p
set published = false
where p.published
  and (
    (coalesce(p.category_code, p.category) = 'bombillas' and not exists (
      select 1 from public.commerce_attribute_options o
      where o.attribute_code = 'largo-mm'
        and o.code = p.attributes->>'largo-mm'
        and o.active
    ))
    or (coalesce(p.category_code, p.category) = 'cintos' and not exists (
      select 1 from public.commerce_attribute_options o
      where o.attribute_code = 'largo-cinto-cm'
        and o.code = p.attributes->>'largo-cinto-cm'
        and o.active
    ))
  );
