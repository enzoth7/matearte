-- Optional catalog details live on the original wholesale row, preserving its ID,
-- model, variant and ARS/UYU prices for the production dashboard and old orders.
alter table public.products
  add column if not exists category_code text,
  add column if not exists description text not null default '',
  add column if not exists sku text,
  add column if not exists weight_grams integer;

alter table public.products
  add constraint products_weight_grams_nonnegative
  check (weight_grams is null or weight_grams >= 0);

create table public.wholesale_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  alt_text text not null default '',
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sort_order integer not null default 0,
  option_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wholesale_product_image_path check (
    split_part(storage_path, '/', 1) = 'wholesale'
    and split_part(storage_path, '/', 2) = product_id
  )
);

create index wholesale_product_images_product_order_idx
  on public.wholesale_product_images(product_id, sort_order, created_at);

alter table public.wholesale_product_images enable row level security;
grant select, insert, update, delete on public.wholesale_product_images to authenticated;

create policy wholesale_product_images_admin_select
  on public.wholesale_product_images for select to authenticated
  using ((select private.is_commerce_admin()));
create policy wholesale_product_images_admin_insert
  on public.wholesale_product_images for insert to authenticated
  with check ((select private.is_commerce_admin()));
create policy wholesale_product_images_admin_update
  on public.wholesale_product_images for update to authenticated
  using ((select private.is_commerce_admin()))
  with check ((select private.is_commerce_admin()));
create policy wholesale_product_images_admin_delete
  on public.wholesale_product_images for delete to authenticated
  using ((select private.is_commerce_admin()));

-- Reuse the public product-images bucket, but only allow admin uploads below
-- wholesale/<existing product id>/...; the existing web-catalog policy is untouched.
create policy wholesale_product_images_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select private.is_commerce_admin())
    and (storage.foldername(name))[1] = 'wholesale'
    and exists (
      select 1 from public.products product
      where product.id = (storage.foldername(name))[2]
    )
  );
