insert into public.commerce_categories (code, label_es, parent_code, active, sort_order)
values ('zapatos', 'Zapatos', null, true, 37)
on conflict (code) do update set
  label_es = excluded.label_es,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values ('tipo-cierre', 'Cierre y sujeción', 'enum', null, 'buttons', true, 25)
on conflict (code) do update set
  label_es = excluded.label_es,
  data_type = excluded.data_type,
  input_style = excluded.input_style,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('tipo-cierre', 'con-cierre', 'Con cierre', null, true, 10),
  ('tipo-cierre', 'con-cordones', 'Con cordones', null, true, 20),
  ('tipo-cierre', 'con-hebilla', 'Con hebilla', null, true, 30),
  ('tipo-cierre', 'con-elastico', 'Con elástico', null, true, 40)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
select 'zapatos', attribute_code, scope, required, filterable, purchase_selectable, sort_order
from public.commerce_category_attributes
where category_code = 'botas'
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
values
  ('botas', 'tipo-cierre', 'product', false, true, false, 25),
  ('zuecos', 'tipo-cierre', 'product', false, true, false, 25),
  ('zapatos', 'tipo-cierre', 'product', false, true, false, 25)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
