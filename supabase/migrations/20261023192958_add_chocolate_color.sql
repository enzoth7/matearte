insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('color', 'chocolate', 'Chocolate', '#4B2E24', true, 145)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  swatch_hex = excluded.swatch_hex,
  active = excluded.active,
  sort_order = excluded.sort_order;
