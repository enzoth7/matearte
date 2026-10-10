-- Engraving services available only in the local sales application.
-- The base price is intentionally UYU 9 and can be adjusted when recording a sale.

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
    'grabado-laser-local',
    'Grabado laser',
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
    'grabado-con-aplique-local',
    'Grabado con aplique',
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
  900,
  900,
  'UYU',
  true,
  '{}'::jsonb
from (
  values
    ('grabado-laser-local', '215'),
    ('grabado-con-aplique-local', '216')
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
