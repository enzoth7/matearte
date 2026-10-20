-- Unify the visible catalog without merging products, variants, stock or order history.
insert into public.commerce_categories (code, label_es, parent_code, sort_order, active)
values ('personalizados', 'Personalizados', null, 100, true)
on conflict (code) do update set label_es = excluded.label_es, active = true, sort_order = excluded.sort_order;

insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values ('tipo-personalizado', 'Tipo', 'enum', null, 'select', true, 1),
       ('diseno-matera', 'Diseño de la matera', 'enum', null, 'select', true, 30)
on conflict (code) do update set label_es = excluded.label_es, data_type = excluded.data_type,
  input_style = excluded.input_style, active = true, sort_order = excluded.sort_order;

insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values ('tipo-personalizado', 'mate', 'Mate', null, true, 10),
       ('tipo-personalizado', 'matera', 'Matera', null, true, 20),
       ('diseno-matera', 'logo', 'Logo', null, true, 10),
       ('diseno-matera', 'texto', 'Texto', null, true, 20),
       ('diseno-matera', 'logo-y-texto', 'Logo y texto', null, true, 30)
on conflict (attribute_code, code) do update set label_es = excluded.label_es,
  active = true, sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, sort_order)
values ('personalizados', 'tipo-personalizado', 'product', true, true, 1),
       ('personalizados', 'diseno-matera', 'product', true, true, 30),
       ('personalizados', 'color', 'variant', false, true, 100)
on conflict (category_code, attribute_code, scope) do update set required = excluded.required,
  filterable = excluded.filterable, sort_order = excluded.sort_order;

-- Preserve compatibility values on historical, incomplete mate fichas.
create or replace function private.validate_mate_catalog_variant()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  product_row public.commerce_products%rowtype;
  rim_label text;
  leather_label text;
  custom_mate boolean;
begin
  select * into product_row from public.commerce_products where id = new.product_id;
  custom_mate := product_row.category_code = 'personalizados'
    and product_row.attributes ->> 'tipo-personalizado' = 'mate';
  if product_row.category_code in ('mates', 'mates-personalizados') then
    perform private.assert_mate_product_identity(product_row.category_code, product_row.attributes);
  end if;
  if product_row.category_code in ('mates', 'mates-personalizados') or custom_mate then
    if custom_mate and (coalesce(product_row.attributes ->> 'material-mate', '') = ''
      or coalesce(product_row.attributes ->> 'tipo-virola', '') = ''
      or coalesce(product_row.attributes ->> 'tipo-cuero', '') = ''
      or coalesce(product_row.attributes ->> 'posamate', '') = '') then
      if tg_op = 'INSERT' then
        raise exception 'Completá material, virola, cuero y posamate antes de crear variantes'
          using errcode = '22023';
      end if;
      return new;
    end if;
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

create or replace function private.propagate_mate_product_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.category_code = 'personalizados' and new.attributes ->> 'tipo-personalizado' = 'mate'
    and (coalesce(new.attributes ->> 'material-mate', '') = ''
      or coalesce(new.attributes ->> 'tipo-virola', '') = ''
      or coalesce(new.attributes ->> 'tipo-cuero', '') = ''
      or coalesce(new.attributes ->> 'posamate', '') = '') then
    return new;
  end if;
  update public.commerce_variants
  set rim_type = case when new.category_code in ('mates', 'mates-personalizados')
          or (new.category_code = 'personalizados' and new.attributes ->> 'tipo-personalizado' = 'mate')
        then coalesce((select label_es from public.commerce_attribute_options
          where attribute_code = 'tipo-virola' and code = new.attributes ->> 'tipo-virola'), '')
        else '' end,
      leather_type = case when new.category_code in ('mates', 'mates-personalizados')
          or (new.category_code = 'personalizados' and new.attributes ->> 'tipo-personalizado' = 'mate')
        then coalesce((select label_es from public.commerce_attribute_options
          where attribute_code = 'tipo-cuero' and code = new.attributes ->> 'tipo-cuero'), '')
        else '' end
  where product_id = new.id;
  return new;
end;
$$;

update public.commerce_products
set category = 'personalizados', category_code = 'personalizados',
    attributes = coalesce(attributes, '{}'::jsonb) || '{"tipo-personalizado":"mate"}'::jsonb
where category_code = 'mates-personalizados';

update public.commerce_products
set attributes = coalesce(attributes, '{}'::jsonb) ||
    jsonb_build_object('tipo-personalizado', case
      when editorial_slug = 'matera-personalizada-local' then 'matera' else 'mate' end),
    name = case when editorial_slug = 'mate-personalizado-local' and name = 'Mate personalizado'
      then 'Mate a medida' else name end
where category_code = 'personalizados'
  and editorial_slug in ('mate-personalizado-local', 'matera-personalizada-local');

update public.commerce_categories set active = false where code = 'mates-personalizados';

-- Existing incomplete fichas are preserved by the migration, but any future
-- edit to a personalized mate must complete the required characteristics.
create or replace function private.validate_mate_product_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.category_code = 'personalizados' then
    if coalesce(new.attributes ->> 'tipo-personalizado', '') not in ('mate', 'matera') then
      raise exception 'Elegí Mate o Matera para este producto' using errcode = '22023';
    end if;
    if new.attributes ->> 'tipo-personalizado' = 'mate' then
      perform private.assert_mate_product_identity('mates', new.attributes);
    end if;
  else
    perform private.assert_mate_product_identity(new.category_code, new.attributes);
  end if;
  return new;
end;
$$;
