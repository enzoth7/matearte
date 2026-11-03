drop policy if exists product_images_admin_insert on storage.objects;

create policy product_images_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select private.is_commerce_admin())
  and exists (
    select 1
    from public.commerce_products as product
    where product.id::text = (storage.foldername(objects.name))[1]
  )
);

drop policy if exists product_images_admin_update on storage.objects;

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
    from public.commerce_products as product
    where product.id::text = (storage.foldername(objects.name))[1]
  )
);
