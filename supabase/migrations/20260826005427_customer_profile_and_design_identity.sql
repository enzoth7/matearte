-- Customer onboarding data, private avatars and idempotent design identities.

alter table public.customer_profiles
  add column birth_date date,
  add column department text,
  add column city text,
  add column address_line1 text,
  add column postal_code text,
  add column avatar_path text,
  add column profile_completed_at timestamptz;

alter table public.customer_profiles
  add constraint customer_profiles_birth_date_check
    check (birth_date is null or (birth_date <= current_date and birth_date >= date '1900-01-01')),
  add constraint customer_profiles_department_check
    check (department is null or char_length(department) between 1 and 80),
  add constraint customer_profiles_city_check
    check (city is null or char_length(city) between 1 and 120),
  add constraint customer_profiles_address_line1_check
    check (address_line1 is null or char_length(address_line1) between 1 and 180),
  add constraint customer_profiles_postal_code_check
    check (postal_code is null or char_length(postal_code) <= 20),
  add constraint customer_profiles_avatar_path_check
    check (avatar_path is null or (char_length(avatar_path) <= 240 and avatar_path like user_id::text || '/%')),
  add constraint customer_profiles_completion_check
    check (
      profile_completed_at is null
      or (
        birth_date is not null
        and nullif(btrim(department), '') is not null
        and nullif(btrim(city), '') is not null
        and nullif(btrim(address_line1), '') is not null
      )
    );

alter table public.designs
  add column design_code text,
  add column client_draft_id uuid;

update public.designs
set
  design_code = 'MA-' || upper(substr(replace(id::text, '-', ''), 1, 8)),
  client_draft_id = id
where design_code is null or client_draft_id is null;

alter table public.designs
  alter column design_code set default ('MA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  alter column design_code set not null,
  alter column client_draft_id set default gen_random_uuid(),
  alter column client_draft_id set not null;

alter table public.designs
  add constraint designs_design_code_key unique (design_code),
  add constraint designs_user_client_draft_key unique (user_id, client_draft_id),
  add constraint designs_design_code_format_check check (design_code ~ '^MA-[0-9A-F]{8}$');

alter table public.designs drop constraint designs_status_check;
alter table public.designs
  add constraint designs_status_check check (status in ('draft', 'saved', 'archived'));

create index designs_user_status_updated_idx
  on public.designs (user_id, status, updated_at desc);

-- Private avatar bucket. Objects use user_id/filename so every operation can
-- be restricted to the authenticated owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy profile_avatar_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatar_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatar_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatar_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on column public.designs.client_draft_id is
  'Stable client-generated identity used to make first draft creation idempotent across retries and OAuth redirects.';
comment on column public.designs.design_code is
  'Short human-readable code shown in the customer profile; the UUID remains the database identity.';
