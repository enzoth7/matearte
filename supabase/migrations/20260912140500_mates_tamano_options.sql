-- Update 'tamano' attribute options and add variant rule for mates

insert into public.commerce_attribute_options (attribute_code, code, label_es, swatch_hex, sort_order)
values
  ('tamano', 'chico', 'Chico', null, 10),
  ('tamano', 'mediano', 'Mediano', null, 20),
  ('tamano', 'grande', 'Grande', null, 30)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  swatch_hex = excluded.swatch_hex,
  sort_order = excluded.sort_order;

delete from public.commerce_attribute_options
where attribute_code = 'tamano' and code = 'pequeno';

insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('mates', 'tamano', 'variant', false, true, 110)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;
