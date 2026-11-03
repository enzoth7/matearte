-- Keep public category reads independent from the admin-only helper function.
-- Permissive policies combine with OR, so commerce admins retain access to
-- inactive categories while everyone else can only read active categories.

drop policy if exists taxonomy_categories_public_read on public.commerce_categories;
create policy taxonomy_categories_public_read
on public.commerce_categories
for select
to anon, authenticated
using (active);

drop policy if exists taxonomy_categories_admin_read on public.commerce_categories;
create policy taxonomy_categories_admin_read
on public.commerce_categories
for select
to authenticated
using ((select private.is_commerce_admin()));
