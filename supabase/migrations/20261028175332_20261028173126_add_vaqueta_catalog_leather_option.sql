insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('tipo-cuero', 'vaqueta', 'Vaqueta', null, true, 60)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  active = true,
  sort_order = excluded.sort_order;
