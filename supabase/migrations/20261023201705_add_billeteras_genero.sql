-- Reuse the existing gender attribute and options for wallets.
insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
values ('billeteras', 'genero', 'product', false, true, false, 20)
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
