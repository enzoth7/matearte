-- Public visitors can read only the published document; draft/archive stay RPC-only.
grant select on public.visualizer_catalog_versions to anon, authenticated;
create policy visualizer_catalog_published_read
on public.visualizer_catalog_versions for select to anon, authenticated
using (status = 'published');

alter function public.get_published_visualizer_catalog() security invoker;
