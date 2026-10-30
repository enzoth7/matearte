alter table public.visualizer_icons
  drop constraint visualizer_icons_storage_path_check;

alter table public.visualizer_icons
  add constraint visualizer_icons_storage_path_check
  check (storage_path ~ '^icons/[0-9a-f-]{36}[.](png|webp|svg)$');

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
where id = 'visualizer-catalog'
  and not ('image/svg+xml' = any(allowed_mime_types));
