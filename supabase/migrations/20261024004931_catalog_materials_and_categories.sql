-- New product families use the shared catalog material and color definitions.
insert into public.commerce_categories (code, label_es, parent_code, active, sort_order)
values
  ('tablas-de-picar', 'Tablas de picar', null, true, 140),
  ('pinchos', 'Pinchos', null, true, 150),
  ('servilleteros', 'Servilleteros', null, true, 160),
  ('porta-rollos', 'Porta rollos', null, true, 170),
  ('vainas', 'Vainas', null, true, 180),
  ('recado', 'Recado', null, true, 190),
  ('carona', 'Carona', null, true, 200)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.commerce_category_attributes
  (category_code, attribute_code, scope, required, filterable, purchase_selectable, sort_order)
select categories.code, template.attribute_code, template.scope,
  template.required, template.filterable, template.purchase_selectable, template.sort_order
from (values
  ('tablas-de-picar'), ('pinchos'), ('servilleteros'), ('porta-rollos'),
  ('vainas'), ('recado'), ('carona')
) as categories(code)
cross join public.commerce_category_attributes template
where template.category_code = 'bandolera'
  and template.attribute_code in ('coleccion', 'material', 'color')
on conflict (category_code, attribute_code, scope) do update set
  required = excluded.required,
  filterable = excluded.filterable,
  purchase_selectable = excluded.purchase_selectable,
  sort_order = excluded.sort_order;
