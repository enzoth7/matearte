-- Commerce administrators need read-only access to the private files copied into
-- personalized order snapshots. Customers keep their existing owner policies.
drop policy if exists commerce_admin_personalization_assets_select on storage.objects;

create policy commerce_admin_personalization_assets_select
on storage.objects
for select
to authenticated
using (
  bucket_id in ('design-assets', 'design-previews', 'order-assets')
  and (select private.is_commerce_admin())
);

comment on policy commerce_admin_personalization_assets_select on storage.objects is
  'Allows active commerce administrators to preview and download private customer files attached to personalized orders.';
