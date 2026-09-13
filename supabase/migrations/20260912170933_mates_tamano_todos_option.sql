insert into public.commerce_attribute_options (attribute_code, code, label_es, swatch_hex, sort_order, active)
values ('tamano', 'todos', 'Todos los tamaños', null, 5, true)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  sort_order = excluded.sort_order,
  active = excluded.active;
