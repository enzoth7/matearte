-- Repair services available only in the local sales application.

insert into public.commerce_categories (code, label_es, parent_code, sort_order, active)
values ('servicios', 'Servicios', null, 115, true)
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
    'cambio-coco-alpaca-local',
    'Cambio de coco alpaca',
    'servicios',
    'servicios',
    '',
    'standard',
    false,
    0,
    '{"colors": [], "finishes": [], "materials": [], "productTypes": []}'::jsonb,
    '{}'::jsonb
  ),
  (
    'cambio-coco-plata-local',
    'Cambio de coco plata',
    'servicios',
    'servicios',
    '',
    'standard',
    false,
    0,
    '{"colors": [], "finishes": [], "materials": [], "productTypes": []}'::jsonb,
    '{}'::jsonb
  ),
  (
    'cambio-calabaza-ceramica-local',
    'Cambio de calabaza/cerámica',
    'servicios',
    'servicios',
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
  seed.price_minor,
  seed.price_minor,
  'UYU',
  true,
  '{}'::jsonb
from (
  values
    ('cambio-coco-alpaca-local', '209', 50000::bigint),
    ('cambio-coco-plata-local', '210', 270000::bigint),
    ('cambio-calabaza-ceramica-local', '211', 70000::bigint)
) as seed(editorial_slug, sku, price_minor)
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
