-- The interior is selected at purchase time; commercial variants remain color-only.
insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values ('interior', 'Interior', 'enum', null, 'select', true, 45)
on conflict (code) do update
set label_es = excluded.label_es, data_type = excluded.data_type,
    input_style = excluded.input_style, active = true, sort_order = excluded.sort_order;

insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('interior', 'todos', 'Todos los interiores', null, true, 5),
  ('interior', 'calabaza', 'Calabaza', null, true, 10),
  ('interior', 'ceramica', 'Cerámica', null, true, 20)
on conflict (attribute_code, code) do update
set label_es = excluded.label_es, active = true, sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
values ('mates', 'interior', 'product', false, true, true, 45)
on conflict (category_code, attribute_code, scope) do update
set purchase_selectable = true, filterable = true, sort_order = excluded.sort_order;

-- Legacy mate identity fields may be incomplete. Preserve timestamps so this
-- bulk data correction does not move every mate to the top of "Nuevo".
alter table public.commerce_products disable trigger validate_mate_product_identity;
alter table public.commerce_products disable trigger propagate_mate_product_identity;
alter table public.commerce_products disable trigger commerce_products_updated_at;

update public.commerce_products p
set attributes = jsonb_set(
  coalesce(p.attributes, '{}'::jsonb), '{interior}',
  to_jsonb(case
    when p.attributes->>'tipo-mate' = 'torpedo' or p.name ~* '\mtorpedo\M' then 'calabaza'
    when p.attributes->>'tipo-mate' in ('imperial', 'camionero')
      or p.name ~* '\m(imperial|camionero)\M' then 'todos'
    else 'calabaza'
  end), true)
where (
    coalesce(p.category_code, p.category) = 'mates'
    or (coalesce(p.category_code, p.category) = 'personalizados'
        and p.attributes->>'tipo-personalizado' = 'mate')
  )
  and not (coalesce(p.attributes, '{}'::jsonb) ? 'interior');

alter table public.commerce_products enable trigger commerce_products_updated_at;
alter table public.commerce_products enable trigger propagate_mate_product_identity;
alter table public.commerce_products enable trigger validate_mate_product_identity;
