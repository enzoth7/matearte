insert into public.commerce_attribute_options
  (attribute_code, code, label_es, active, sort_order)
values
  ('diseno-fleje', 'laureles', 'Laureles', true, 90)
on conflict (attribute_code, code) do update
set label_es = excluded.label_es,
    active = excluded.active,
    sort_order = excluded.sort_order;
