-- Scheduled storefront announcements managed from Gestión.

create table public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique check (char_length(image_path) between 3 and 500),
  original_name text not null check (char_length(original_name) between 1 and 240),
  alt_text text not null default 'Aviso de Matearte' check (char_length(btrim(alt_text)) between 1 and 240),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 8388608),
  valid_from date not null,
  valid_until date not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

create index site_announcements_active_window_idx
  on public.site_announcements (enabled, valid_from, valid_until, created_at desc);

create trigger site_announcements_updated_at
before update on public.site_announcements
for each row execute function private.set_updated_at();

revoke all on public.site_announcements from public, anon, authenticated;
grant select on public.site_announcements to anon, authenticated;
grant insert, update, delete on public.site_announcements to authenticated;

alter table public.site_announcements enable row level security;

create policy site_announcements_public_current_read
on public.site_announcements
for select
to anon, authenticated
using (
  enabled
  and (now() at time zone 'America/Montevideo')::date between valid_from and valid_until
);

create policy site_announcements_admin_read
on public.site_announcements
for select
to authenticated
using ((select private.is_commerce_admin()));

create policy site_announcements_admin_insert
on public.site_announcements
for insert
to authenticated
with check ((select private.is_commerce_admin()));

create policy site_announcements_admin_update
on public.site_announcements
for update
to authenticated
using ((select private.is_commerce_admin()))
with check ((select private.is_commerce_admin()));

create policy site_announcements_admin_delete
on public.site_announcements
for delete
to authenticated
using ((select private.is_commerce_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-announcements',
  'site-announcements',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy site_announcements_storage_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'site-announcements'
  and (select private.is_commerce_admin())
);

create policy site_announcements_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-announcements'
  and (select private.is_commerce_admin())
);

create policy site_announcements_storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-announcements'
  and (select private.is_commerce_admin())
)
with check (
  bucket_id = 'site-announcements'
  and (select private.is_commerce_admin())
);

create policy site_announcements_storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-announcements'
  and (select private.is_commerce_admin())
);

comment on table public.site_announcements is
  'Public storefront announcement images with an inclusive Montevideo date window. Only active commerce administrators may manage them.';
