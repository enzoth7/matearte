-- Colecciones editoriales asignables a cualquier producto del catálogo.
insert into public.commerce_attribute_definitions
  (code, label_es, data_type, unit, input_style, active, sort_order)
values
  ('coleccion', 'Colección', 'enum', null, 'select', true, 5)
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
  ('coleccion', 'estribo', 'Estribo', null, true, 10),
  ('coleccion', 'uruguay', 'Uruguay', null, true, 20),
  ('coleccion', 'alfonsina', 'Alfonsina', null, true, 30)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  active = true,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, sort_order)
select code, 'coleccion', 'product', false, true, 5
from public.commerce_categories
where active
on conflict (category_code, attribute_code, scope) do update set
  required = false,
  filterable = true,
  sort_order = excluded.sort_order;
