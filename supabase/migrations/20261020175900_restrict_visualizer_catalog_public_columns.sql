-- The browser only needs the published document, never editor identity or timestamps.
revoke select on public.visualizer_catalog_versions from anon, authenticated;
grant select (status, document) on public.visualizer_catalog_versions to anon, authenticated;
