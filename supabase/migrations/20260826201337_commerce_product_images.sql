-- Public product photography with database-backed ordering and admin-only writes.

create table public.commerce_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 3 and 500),
  original_name text not null check (char_length(original_name) between 1 and 240),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commerce_product_images_product_order_idx
  on public.commerce_product_images (product_id, sort_order, created_at);

create trigger commerce_product_images_updated_at
before update on public.commerce_product_images
for each row execute function private.set_updated_at();

revoke all on public.commerce_product_images from anon, authenticated;
grant select on public.commerce_product_images to anon, authenticated;
grant insert, update, delete on public.commerce_product_images to authenticated;

alter table public.commerce_product_images enable row level security;

create policy product_images_published_read
on public.commerce_product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.commerce_products product
    where product.id = product_id and product.published
  )
);

create policy product_images_admin_read
on public.commerce_product_images
for select
to authenticated
using ((select private.is_commerce_admin()));

create policy product_images_admin_insert
on public.commerce_product_images
for insert
to authenticated
with check ((select private.is_commerce_admin()));

create policy product_images_admin_update
on public.commerce_product_images
for update
to authenticated
using ((select private.is_commerce_admin()))
with check ((select private.is_commerce_admin()));

create policy product_images_admin_delete
on public.commerce_product_images
for delete
to authenticated
using ((select private.is_commerce_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
);

create policy product_images_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
  and exists (
    select 1
    from public.commerce_products product
    where product.id::text = (storage.foldername(name))[1]
  )
);

create policy product_images_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
)
with check (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
  and exists (
    select 1
    from public.commerce_products product
    where product.id::text = (storage.foldername(name))[1]
  )
);

create policy product_images_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
);

comment on table public.commerce_product_images is
  'Ordered public storefront imagery. Only active commerce administrators may mutate rows and storage objects.';
