insert into public.commerce_attribute_options
  (attribute_code, code, label_es, swatch_hex, active, sort_order)
values
  ('color', 'blanco-dorado', 'Blanco/Dorado', '#F5F5F5', true, 175)
on conflict (attribute_code, code) do nothing;
