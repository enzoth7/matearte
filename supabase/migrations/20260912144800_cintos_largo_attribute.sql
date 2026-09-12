-- Add 'largo-cinto-cm' attribute definition and category rule for cintos

insert into public.commerce_attribute_definitions (code, label_es, data_type, unit, input_style, active, sort_order)
values ('largo-cinto-cm', 'Largo del cinto', 'number', 'cm', 'number', true, 90)
on conflict (code) do update set
  label_es = excluded.label_es,
  data_type = excluded.data_type,
  unit = excluded.unit,
  input_style = excluded.input_style,
  active = excluded.active;

insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values ('cintos', 'largo-cinto-cm', 'product', false, true, 20)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;
