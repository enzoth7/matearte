-- Tarjeteros use the same product characteristics and color variants as wallets.
insert into public.commerce_categories (code, label_es, parent_code, active, sort_order)
values ('tarjeteros', 'Tarjetero', null, true, 15)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
select 'tarjeteros', attribute_code, scope, required, filterable, purchase_selectable, sort_order
from public.commerce_category_attributes
where category_code = 'billeteras'
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
