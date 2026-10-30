-- Built-in icons remain in the deployed assets and historical designs, but can
-- be hidden from new customizations without rebuilding either application.
create table public.visualizer_hidden_builtin_icons (
  icon_id text primary key check (icon_id ~ '^[a-z0-9-]{1,120}$'),
  hidden_at timestamptz not null default now()
);

alter table public.visualizer_hidden_builtin_icons enable row level security;
revoke all on public.visualizer_hidden_builtin_icons from public, anon, authenticated;
grant select on public.visualizer_hidden_builtin_icons to anon, authenticated;
grant insert (icon_id) on public.visualizer_hidden_builtin_icons to authenticated;
grant delete on public.visualizer_hidden_builtin_icons to authenticated;

create policy visualizer_hidden_icons_read on public.visualizer_hidden_builtin_icons
  for select to anon, authenticated using (true);
create policy visualizer_hidden_icons_staff_insert on public.visualizer_hidden_builtin_icons
  for insert to authenticated
  with check ((select private.can_manage_visualizer_pricing()));
create policy visualizer_hidden_icons_staff_delete on public.visualizer_hidden_builtin_icons
  for delete to authenticated
  using ((select private.can_manage_visualizer_pricing()));
