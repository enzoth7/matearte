-- Add 'mates-personalizados' category and attribute rules

insert into public.commerce_categories (code, label_es, parent_code, sort_order, active)
values ('mates-personalizados', 'Mates Personalizados', null, 100, true)
on conflict (code) do update set
  label_es = excluded.label_es,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Reorder categories alphabetically
update public.commerce_categories set sort_order = 10 where code = 'billeteras';
update public.commerce_categories set sort_order = 20 where code = 'bombillas';
update public.commerce_categories set sort_order = 30 where code = 'botas';
update public.commerce_categories set sort_order = 40 where code = 'carteras';
update public.commerce_categories set sort_order = 50 where code = 'cintos';
update public.commerce_categories set sort_order = 60 where code = 'cuchillos';
update public.commerce_categories set sort_order = 70 where code = 'kits-materos';
update public.commerce_categories set sort_order = 80 where code = 'materas';
update public.commerce_categories set sort_order = 90 where code = 'mates';
update public.commerce_categories set sort_order = 100 where code = 'mates-personalizados';
update public.commerce_categories set sort_order = 110 where code = 'termos';

insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('mates-personalizados', 'tipo-mate', 'product', false, true, 10),
  ('mates-personalizados', 'material', 'product', false, true, 20),
  ('mates-personalizados', 'acabado', 'product', false, true, 30),
  ('mates-personalizados', 'color', 'variant', false, true, 100),
  ('mates-personalizados', 'tamano', 'variant', false, true, 110)
on conflict do nothing;

