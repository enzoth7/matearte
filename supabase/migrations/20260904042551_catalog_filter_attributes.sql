-- Product-level attributes for the public catalog filters. They deliberately
-- live on the product rather than on a variant: a single product card may
-- offer several colors while remaining one catalog item.
alter table public.commerce_products
  add column if not exists catalog_filters jsonb not null default '{"materials": [], "productTypes": [], "finishes": [], "colors": []}'::jsonb;

alter table public.commerce_products
  drop constraint if exists commerce_products_catalog_filters_shape;

alter table public.commerce_products
  add constraint commerce_products_catalog_filters_shape
  check (
    jsonb_typeof(catalog_filters) = 'object'
    and jsonb_typeof(catalog_filters -> 'materials') = 'array'
    and jsonb_typeof(catalog_filters -> 'productTypes') = 'array'
    and jsonb_typeof(catalog_filters -> 'finishes') = 'array'
    and jsonb_typeof(catalog_filters -> 'colors') = 'array'
  );

comment on column public.commerce_products.catalog_filters is
  'Normalized catalog filter attributes: materials, productTypes, finishes and colors.';
