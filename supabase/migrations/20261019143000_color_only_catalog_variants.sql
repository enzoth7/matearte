-- A variant is only a color. Every other commercial difference belongs to the
-- product identity, so changing rim, leather, size, capacity, etc. means a
-- different product rather than another variant.

insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values
  ('tipo-virola', 'Tipo de virola', 'enum', null, 'select', true, 16),
  ('tipo-cuero', 'Tipo de cuero', 'enum', null, 'select', true, 17),
  ('posamate', 'Posamate', 'enum', null, 'select', true, 18)
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
  ('tipo-virola', 'acero-liso', 'Acero Liso', null, true, 10),
  ('tipo-virola', 'alpaca-grande-cincelada', 'Alpaca Grande Cincelada', null, true, 20),
  ('tipo-virola', 'alpaca-y-bronce', 'Alpaca y Bronce', null, true, 30),
  ('tipo-virola', 'alpaca-cincelada', 'Alpaca Cincelada', null, true, 40),
  ('tipo-virola', 'imperial', 'Imperial', null, true, 50),
  ('tipo-virola', 'alpaca', 'Alpaca', null, true, 60),
  ('tipo-virola', 'alpaca-comun', 'Alpaca Común', null, true, 70),
  ('tipo-virola', 'alpaca-grande-lisa', 'Alpaca Grande Lisa', null, true, 80),
  ('tipo-virola', 'acero', 'Acero', null, true, 90),
  ('tipo-cuero', 'liso', 'Liso', null, true, 10),
  ('tipo-cuero', 'crudo', 'Crudo', null, true, 20),
  ('tipo-cuero', 'estampado', 'Estampado', null, true, 30),
  ('tipo-cuero', 'croco', 'Croco', null, true, 40),
  ('tipo-cuero', 'pelos', 'Pelos', null, true, 50),
  ('posamate', 'sin-posamate', 'Sin posamate', null, true, 10),
  ('posamate', 'con-posamate', 'Con posamate', null, true, 20),
  ('material-mate', 'cuero', 'Cuero', null, true, 30)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  swatch_hex = excluded.swatch_hex,
  active = true,
  sort_order = excluded.sort_order;

-- Preserve every non-color characteristic by moving its rule to product scope.
insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, sort_order)
select category_code, attribute_code, 'product', required, filterable,
  case when sort_order >= 100 then sort_order - 70 else sort_order end
from public.commerce_category_attributes
where scope = 'variant' and attribute_code <> 'color'
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;

delete from public.commerce_category_attributes
where scope = 'variant' and attribute_code <> 'color';

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('mates', 'tipo-virola', 'product', true, true, 16),
  ('mates', 'tipo-cuero', 'product', true, true, 17),
  ('mates', 'posamate', 'product', true, true, 18),
  ('mates-personalizados', 'tipo-virola', 'product', true, true, 16),
  ('mates-personalizados', 'tipo-cuero', 'product', true, true, 17),
  ('mates-personalizados', 'posamate', 'product', true, true, 18)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;

-- Backfill product-level mate details only when all historical variants agree.
-- Ambiguous products are intentionally left pending for manual separation; no
-- historical sale or quantity is rewritten by this migration.
with agreed as (
  select product_id,
    case when count(distinct nullif(trim(rim_type), '')) = 1 then max(nullif(trim(rim_type), '')) end as rim,
    case when count(distinct nullif(trim(leather_type), '')) = 1 then max(nullif(trim(leather_type), '')) end as leather
  from public.commerce_variants
  group by product_id
)
update public.commerce_products product
set attributes = product.attributes
  || case when product.attributes ->> 'tipo-virola' is null and agreed.rim is not null then
    jsonb_build_object('tipo-virola', case agreed.rim
      when 'Acero Liso' then 'acero-liso'
      when 'Alpaca Grande Cincelada' then 'alpaca-grande-cincelada'
      when 'Alpaca y Bronce' then 'alpaca-y-bronce'
      when 'Alpaca Cincelada' then 'alpaca-cincelada'
      when 'Imperial' then 'imperial'
      when 'Alpaca' then 'alpaca'
      when 'Alpaca Común' then 'alpaca-comun'
      when 'Alpaca Grande Lisa' then 'alpaca-grande-lisa'
      when 'Acero' then 'acero'
      else null end) else '{}'::jsonb end
  || case when product.attributes ->> 'tipo-cuero' is null and agreed.leather is not null then
    jsonb_build_object('tipo-cuero', case lower(agreed.leather)
      when 'liso' then 'liso' when 'crudo' then 'crudo'
      when 'estampado' then 'estampado' when 'croco' then 'croco'
      when 'pelos' then 'pelos' else null end) else '{}'::jsonb end
  || case when product.attributes ->> 'posamate' is null
      and concat_ws(' ', product.name, product.description) ~* 'posa[ -]?mate'
    then jsonb_build_object('posamate', 'con-posamate') else '{}'::jsonb end
from agreed
where product.id = agreed.product_id
  and product.category_code in ('mates', 'mates-personalizados');

create or replace function private.validate_color_only_catalog_variant()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from jsonb_object_keys(coalesce(new.option_values, '{}'::jsonb)) as item(key)
    where item.key <> 'color'
  ) then
    raise exception 'Una variante solo puede diferenciarse por color. Creá otro producto para cualquier otro cambio.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_color_only_catalog_variant on public.commerce_variants;
create trigger validate_color_only_catalog_variant
before insert or update of product_id, option_values on public.commerce_variants
for each row execute function private.validate_color_only_catalog_variant();

create or replace function private.validate_color_only_taxonomy_rule()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.scope = 'variant' and new.attribute_code <> 'color' then
    raise exception 'Solo Color puede configurarse como atributo de variante'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_color_only_taxonomy_rule on public.commerce_category_attributes;
create trigger validate_color_only_taxonomy_rule
before insert or update of scope, attribute_code on public.commerce_category_attributes
for each row execute function private.validate_color_only_taxonomy_rule();

create or replace function private.assert_mate_product_identity(category_value text, attributes_value jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if category_value in ('mates', 'mates-personalizados') then
    if coalesce(attributes_value ->> 'material-mate', '') not in
      ('calabaza', 'ceramica', 'cuero', 'madera', 'acero-inoxidable') then
      raise exception 'Elegí el material del mate' using errcode = '22023';
    end if;
    if coalesce(attributes_value ->> 'tipo-virola', '') not in
      ('acero-liso', 'alpaca-grande-cincelada', 'alpaca-y-bronce',
       'alpaca-cincelada', 'imperial', 'alpaca', 'alpaca-comun',
       'alpaca-grande-lisa', 'acero') then
      raise exception 'Elegí un tipo de virola válido' using errcode = '22023';
    end if;
    if coalesce(attributes_value ->> 'tipo-cuero', '') not in
      ('liso', 'crudo', 'estampado', 'croco', 'pelos') then
      raise exception 'Elegí un tipo de cuero válido' using errcode = '22023';
    end if;
    if coalesce(attributes_value ->> 'posamate', '') not in
      ('sin-posamate', 'con-posamate') then
      raise exception 'Indicá si el producto incluye posamate' using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.validate_mate_product_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform private.assert_mate_product_identity(new.category_code, new.attributes);
  return new;
end;
$$;

drop trigger if exists validate_mate_product_identity on public.commerce_products;
create trigger validate_mate_product_identity
before insert or update of category_code, attributes on public.commerce_products
for each row execute function private.validate_mate_product_identity();

-- Keep compatibility columns synchronized, but derive them from the product.
create or replace function private.validate_mate_catalog_variant()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  product_row public.commerce_products%rowtype;
  rim_label text;
  leather_label text;
begin
  select * into product_row from public.commerce_products where id = new.product_id;
  if product_row.category_code in ('mates', 'mates-personalizados') then
    perform private.assert_mate_product_identity(product_row.category_code, product_row.attributes);
    select label_es into rim_label from public.commerce_attribute_options
      where attribute_code = 'tipo-virola' and code = product_row.attributes ->> 'tipo-virola';
    select label_es into leather_label from public.commerce_attribute_options
      where attribute_code = 'tipo-cuero' and code = product_row.attributes ->> 'tipo-cuero';
    new.rim_type := coalesce(rim_label, '');
    new.leather_type := coalesce(leather_label, '');
  else
    new.rim_type := '';
    new.leather_type := '';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_mate_catalog_variant on public.commerce_variants;
drop trigger if exists apply_mate_product_identity_to_variant on public.commerce_variants;
create trigger apply_mate_product_identity_to_variant
before insert or update of product_id, rim_type, leather_type on public.commerce_variants
for each row execute function private.validate_mate_catalog_variant();

create or replace function private.propagate_mate_product_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.commerce_variants
  set rim_type = case when new.category_code in ('mates', 'mates-personalizados')
        then coalesce((select label_es from public.commerce_attribute_options
          where attribute_code = 'tipo-virola' and code = new.attributes ->> 'tipo-virola'), '')
        else '' end,
      leather_type = case when new.category_code in ('mates', 'mates-personalizados')
        then coalesce((select label_es from public.commerce_attribute_options
          where attribute_code = 'tipo-cuero' and code = new.attributes ->> 'tipo-cuero'), '')
        else '' end
  where product_id = new.id;
  return new;
end;
$$;

drop trigger if exists propagate_mate_product_identity on public.commerce_products;
create trigger propagate_mate_product_identity
after update of category_code, attributes on public.commerce_products
for each row execute function private.propagate_mate_product_identity();

-- Invoke the compatibility synchronization only for already-complete products.
update public.commerce_variants variant
set rim_type = variant.rim_type
from public.commerce_products product
where product.id = variant.product_id
  and product.category_code in ('mates', 'mates-personalizados')
  and product.attributes ->> 'material-mate' is not null
  and product.attributes ->> 'tipo-virola' is not null
  and product.attributes ->> 'tipo-cuero' is not null
  and product.attributes ->> 'posamate' is not null;

comment on column public.commerce_variants.option_values is
  'Purchasable variation values. Only color is allowed; any other difference defines another product.';

\n