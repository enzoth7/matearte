-- Keep public storefront reads independent from the private admin membership
-- helper. The previous shared policies referenced private.is_commerce_admin()
-- for anon requests even though anon intentionally cannot execute it.

drop policy if exists products_public_read on public.commerce_products;
drop policy if exists products_anon_read_published on public.commerce_products;
drop policy if exists products_authenticated_read on public.commerce_products;

create policy products_anon_read_published
on public.commerce_products
for select
to anon
using (published);

create policy products_authenticated_read
on public.commerce_products
for select
to authenticated
using (published or (select private.is_commerce_admin()));

drop policy if exists variants_public_read on public.commerce_variants;
drop policy if exists variants_anon_read_published on public.commerce_variants;
drop policy if exists variants_authenticated_read on public.commerce_variants;

create policy variants_anon_read_published
on public.commerce_variants
for select
to anon
using (
  active
  and exists (
    select 1
    from public.commerce_products product
    where product.id = product_id
      and product.published
  )
);

create policy variants_authenticated_read
on public.commerce_variants
for select
to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.commerce_products product
      where product.id = product_id
        and product.published
    )
  )
  or (select private.is_commerce_admin())
);

-- Explicit grants keep the storefront compatible with the Data API exposure
-- defaults introduced by Supabase in 2026. RLS still decides which rows each
-- role can see.
grant select on table public.commerce_products to anon, authenticated;
grant select on table public.commerce_variants to anon, authenticated;
grant select on table public.commerce_product_images to anon, authenticated;
grant select on table public.commerce_settings to anon, authenticated;
