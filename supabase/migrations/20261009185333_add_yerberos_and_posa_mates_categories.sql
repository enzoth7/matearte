-- New active catalog categories. Existing category/product RLS policies keep
-- reads public and restrict product creation to commerce administrators.

insert into public.commerce_categories (code, label_es, parent_code, sort_order, active)
values
  ('yerberos', 'Yerberos', null, 120, true),
  ('posa-mates', 'Posa mates', null, 130, true)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  sort_order = excluded.sort_order,
  active = excluded.active;
