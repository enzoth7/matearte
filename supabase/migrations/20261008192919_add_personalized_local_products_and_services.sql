-- Local-only personalized products and a services category ready for future items.

insert into public.commerce_categories (code, label_es, parent_code, sort_order, active)
values
  ('personalizados', 'Personalizados', null, 105, true),
  ('servicios', 'Servicios', null, 115, true)
on conflict (code) do update set
  label_es = excluded.label_es,
  parent_code = excluded.parent_code,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.commerce_products (
  editorial_slug,
  name,
  category,
  category_code,
  description,
  sale_mode,
  published,
  peso,
  catalog_filters,
  attributes
)
values
  (
    'mate-personalizado-local',
    'Mate personalizado',
    'personalizados',
    'personalizados',
    '',
    'standard',
    false,
    0,
    '{"colors": [], "finishes": [], "materials": [], "productTypes": []}'::jsonb,
    '{}'::jsonb
  ),
  (
    'matera-personalizada-local',
    'Matera personalizada',
    'personalizados',
    'personalizados',
    '',
    'standard',
    false,
    0,
    '{"colors": [], "finishes": [], "materials": [], "productTypes": []}'::jsonb,
    '{}'::jsonb
  )
on conflict (editorial_slug) do update set
  name = excluded.name,
  category = excluded.category,
  category_code = excluded.category_code,
  description = excluded.description,
  sale_mode = excluded.sale_mode,
  published = excluded.published,
  peso = excluded.peso,
  catalog_filters = excluded.catalog_filters,
  attributes = excluded.attributes;

insert into public.commerce_variants (
  product_id,
  sku,
  name,
  price_minor,
  base_price_minor,
  currency,
  active,
  option_values
)
select
  product.id,
  seed.sku,
  'Venta local',
  0,
  0,
  'UYU',
  true,
  '{}'::jsonb
from (
  values
    ('mate-personalizado-local', '207'),
    ('matera-personalizada-local', '208')
) as seed(editorial_slug, sku)
join public.commerce_products product
  on product.editorial_slug = seed.editorial_slug
on conflict (sku) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  price_minor = excluded.price_minor,
  base_price_minor = excluded.base_price_minor,
  currency = excluded.currency,
  active = excluded.active,
  option_values = excluded.option_values;
