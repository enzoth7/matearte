-- Un solo tipo de limpiabombilla, sin atributos de material ni variantes obligatorias.
insert into public.commerce_categories (code, label_es, parent_code, active, sort_order)
values ('limpiabombillas', 'Limpiabombillas', null, true, 25)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- La ficha de ejemplo estaba bajo Bombillas y heredaba sus detalles técnicos.
update public.commerce_products
set name = 'Limpiabombilla',
    category = 'limpiabombillas',
    category_code = 'limpiabombillas',
    attributes = '{}'::jsonb,
    catalog_filters = jsonb_set(
      jsonb_set(catalog_filters, '{materials}', '[]'::jsonb),
      '{productTypes}', '[]'::jsonb
    )
where editorial_slug = 'limpia-bombillas';
