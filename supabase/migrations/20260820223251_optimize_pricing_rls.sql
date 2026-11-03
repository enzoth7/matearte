create index if not exists pricing_catalog_versions_created_by_idx
  on public.pricing_catalog_versions (created_by) where created_by is not null;
create index if not exists pricing_catalog_versions_published_by_idx
  on public.pricing_catalog_versions (published_by) where published_by is not null;

drop policy if exists "published pricing versions are public" on public.pricing_catalog_versions;
drop policy if exists "admins can read all pricing versions" on public.pricing_catalog_versions;
create policy "published pricing versions are public"
  on public.pricing_catalog_versions for select
  to anon
  using (status = 'published');
create policy "authenticated users read allowed pricing versions"
  on public.pricing_catalog_versions for select
  to authenticated
  using (status = 'published' or private.is_pricing_admin());

drop policy if exists "published pricing values are public" on public.pricing_catalog_values;
drop policy if exists "admins can read all pricing values" on public.pricing_catalog_values;
create policy "published pricing values are public"
  on public.pricing_catalog_values for select
  to anon
  using (
    exists (
      select 1
      from public.pricing_catalog_versions version
      where version.id = version_id
        and version.status = 'published'
    )
  );
create policy "authenticated users read allowed pricing values"
  on public.pricing_catalog_values for select
  to authenticated
  using (
    private.is_pricing_admin()
    or exists (
      select 1
      from public.pricing_catalog_versions version
      where version.id = version_id
        and version.status = 'published'
    )
  );
