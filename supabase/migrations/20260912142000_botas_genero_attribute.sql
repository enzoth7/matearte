-- Add 'genero' attribute and options for calzado and botas

insert into public.commerce_attribute_definitions (code, label_es, data_type, unit, input_style, active, sort_order)
values ('genero', 'Género', 'enum', null, 'select', true, 80)
on conflict (code) do update set
  label_es = excluded.label_es,
  data_type = excluded.data_type,
  input_style = excluded.input_style,
  active = excluded.active;

insert into public.commerce_attribute_options (attribute_code, code, label_es, swatch_hex, sort_order)
values
  ('genero', 'hombre', 'Hombre', null, 10),
  ('genero', 'mujer', 'Mujer', null, 20),
  ('genero', 'unisex', 'Unisex', null, 30)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('calzado', 'genero', 'product', false, true, 20),
  ('botas', 'genero', 'product', false, true, 20)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;
