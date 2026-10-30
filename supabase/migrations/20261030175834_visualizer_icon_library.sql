-- Public icon metadata is shared by the storefront and local sales. Only staff
-- who can manage the visualizer may add or hide icons.
create table public.visualizer_icons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  storage_path text not null unique check (storage_path ~ '^icons/[0-9a-f-]{36}[.](png|webp)$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.visualizer_icons enable row level security;
revoke all on public.visualizer_icons from public, anon, authenticated;
grant select on public.visualizer_icons to anon, authenticated;
grant insert (id, name, storage_path) on public.visualizer_icons to authenticated;
grant update (is_active) on public.visualizer_icons to authenticated;

create policy visualizer_icons_read on public.visualizer_icons
  for select to anon, authenticated using (true);
create policy visualizer_icons_staff_insert on public.visualizer_icons
  for insert to authenticated
  with check ((select private.can_manage_visualizer_pricing()));
create policy visualizer_icons_staff_update on public.visualizer_icons
  for update to authenticated
  using ((select private.can_manage_visualizer_pricing()))
  with check ((select private.can_manage_visualizer_pricing()));

-- A failed metadata write can clean up its freshly uploaded object.
create policy visualizer_icon_upload_cleanup on storage.objects
  for delete to authenticated
  using (bucket_id = 'visualizer-catalog'
    and name like 'icons/%'
    and (select private.can_manage_visualizer_pricing()));
