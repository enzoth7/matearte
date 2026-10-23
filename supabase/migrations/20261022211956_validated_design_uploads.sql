-- Apply only after the web upload handler uses the service client for validated bytes.
-- Restrictive policies also cover future permissive policies and storage copy/move.
create policy design_assets_validated_insert on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'design-assets');
create policy design_assets_validated_update on storage.objects as restrictive
for update to authenticated using (bucket_id <> 'design-assets') with check (bucket_id <> 'design-assets');
revoke insert, update on public.design_assets from authenticated, anon;
drop policy if exists design_assets_insert_own on public.design_assets;
drop policy if exists design_assets_update_own on public.design_assets;
