insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('color', 'dorado-natural', 'Dorado/Natural', '#C9A859', true, 220)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  swatch_hex = excluded.swatch_hex,
  active = excluded.active,
  sort_order = excluded.sort_order;
