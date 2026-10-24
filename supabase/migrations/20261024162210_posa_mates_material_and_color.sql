-- Posa mates share the catalog's material choices and use color for variants.
-- Both attributes remain optional so existing products and their "Única" variants stay valid.
insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
values
  ('posa-mates', 'material', 'product', false, true, false, 10),
  ('posa-mates', 'color', 'variant', false, true, false, 100)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
