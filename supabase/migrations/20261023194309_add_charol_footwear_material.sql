insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('material', 'charol', 'Charol', null, true, 120)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  active = excluded.active,
  sort_order = excluded.sort_order;
