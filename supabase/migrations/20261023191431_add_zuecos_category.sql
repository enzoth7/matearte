-- Zuecos share the product characteristics and purchase selection of boots.
insert into public.commerce_categories (code, label_es, parent_code, active, sort_order)
values ('zuecos', 'Zuecos', null, true, 35)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
select 'zuecos', attribute_code, scope, required, filterable, purchase_selectable, sort_order
from public.commerce_category_attributes
where category_code = 'botas'
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
