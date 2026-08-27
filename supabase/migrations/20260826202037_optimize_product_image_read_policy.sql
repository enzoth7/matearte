drop policy product_images_published_read on public.commerce_product_images;
drop policy product_images_admin_read on public.commerce_product_images;

create policy product_images_public_read
on public.commerce_product_images
for select
to anon
using (
  exists (
    select 1
    from public.commerce_products product
    where product.id = product_id and product.published
  )
);

create policy product_images_authenticated_read
on public.commerce_product_images
for select
to authenticated
using (
  (select private.is_commerce_admin())
  or exists (
    select 1
    from public.commerce_products product
    where product.id = product_id and product.published
  )
);
