-- Published catalog presentation and availability are versioned independently from prices.
-- Stable family/texture/color/metal IDs remain in the application for historical designs.
create table public.visualizer_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  status text not null check (status in ('draft', 'published', 'archived')),
  document jsonb not null default '{}'::jsonb check (jsonb_typeof(document) = 'object'),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null
);

create unique index visualizer_catalog_one_draft on public.visualizer_catalog_versions (status) where status = 'draft';
create unique index visualizer_catalog_one_published on public.visualizer_catalog_versions (status) where status = 'published';
alter table public.visualizer_catalog_versions enable row level security;
revoke all on public.visualizer_catalog_versions from public, anon, authenticated;

insert into public.visualizer_catalog_versions (version, status, document, published_at)
values (1, 'published', '{}', now()), (2, 'draft', '{}', null);

create or replace function private.validate_visualizer_catalog_document(p_document jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  section_name text;
  item_key text;
  item_value jsonb;
  field_name text;
  field_value jsonb;
  technique_id text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' or pg_catalog.octet_length(p_document::text) > 100000 then
    raise exception 'El catálogo tiene un formato inválido o supera el tamaño permitido.';
  end if;
  for section_name, item_value in select key, value from jsonb_each(p_document) loop
    if section_name not in ('families', 'textures', 'colors', 'metals', 'techniques') or jsonb_typeof(item_value) <> 'object' then
      raise exception 'Sección del catálogo inválida: %', section_name;
    end if;
    for item_key, item_value in select key, value from jsonb_each(item_value) loop
      if length(item_key) > 120 or item_key !~ '^[a-z0-9-]+(::[a-z0-9-]+){0,2}$' or jsonb_typeof(item_value) <> 'object' then
        raise exception 'Opción del catálogo inválida: %', item_key;
      end if;
      if (section_name = 'families' and item_key not in ('camionero', 'imperial', 'torpedo', 'criollo'))
        or (section_name = 'techniques' and item_key not in ('laser', 'bronze-applique', 'alpaca-applique')) then
        raise exception 'Identificador del catálogo no permitido: %', item_key;
      end if;
      for field_name, field_value in select key, value from jsonb_each(item_value) loop
        if field_name in ('label', 'description') then
          if jsonb_typeof(field_value) <> 'string' or length(trim(field_value #>> '{}')) not between 1 and 240 then
            raise exception 'Texto inválido para %', item_key;
          end if;
        elsif field_name in ('image', 'flejeImage', 'torpedoImage') then
          if jsonb_typeof(field_value) <> 'string' or length(field_value #>> '{}') > 1000
            or (field_value #>> '{}') !~ '^(/assets/|/assets2/|https://agdkljuulwjwjasftcce[.]supabase[.]co/storage/v1/object/public/visualizer-catalog/)' then
            raise exception 'Imagen inválida para %', item_key;
          end if;
        elsif field_name = 'swatch' and section_name = 'colors' then
          if jsonb_typeof(field_value) <> 'string' or (field_value #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then
            raise exception 'Color de muestra inválido para %', item_key;
          end if;
        elsif field_name = 'enabled' then
          if jsonb_typeof(field_value) <> 'boolean' then raise exception 'Disponibilidad inválida para %', item_key; end if;
        elsif field_name in ('virola', 'fleje') and section_name = 'textures' then
          if jsonb_typeof(field_value) <> 'array' then raise exception 'Técnicas inválidas para %', item_key; end if;
          for technique_id in select jsonb_array_elements_text(field_value) loop
            if technique_id not in ('laser', 'bronze-applique', 'alpaca-applique') then
              raise exception 'Técnica no permitida: %', technique_id;
            end if;
          end loop;
        else
          raise exception 'Campo del catálogo no permitido: %', field_name;
        end if;
        if (section_name = 'families' and field_name not in ('label', 'description', 'image', 'enabled'))
          or (section_name = 'textures' and field_name not in ('label', 'description', 'image', 'enabled', 'virola', 'fleje'))
          or (section_name = 'colors' and field_name not in ('label', 'image', 'swatch', 'enabled'))
          or (section_name = 'metals' and field_name not in ('label', 'image', 'enabled'))
          or (section_name = 'techniques' and field_name not in ('label', 'description', 'image', 'flejeImage', 'torpedoImage', 'enabled')) then
          raise exception 'Campo no aplicable a %: %', section_name, field_name;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

create or replace function public.get_published_visualizer_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select document from public.visualizer_catalog_versions where status = 'published';
$$;

create or replace function public.get_visualizer_catalog_admin_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_visualizer_pricing() then raise exception 'No tenés permiso para configurar el Visualizador.' using errcode = '42501'; end if;
  return (
    select jsonb_build_object(
      'draft', (select jsonb_build_object('id', id, 'version', version, 'updatedAt', updated_at, 'document', document) from public.visualizer_catalog_versions where status = 'draft'),
      'published', (select jsonb_build_object('id', id, 'version', version, 'updatedAt', updated_at, 'document', document) from public.visualizer_catalog_versions where status = 'published')
    )
  );
end;
$$;

create or replace function public.save_visualizer_catalog_draft(p_version_id uuid, p_expected_updated_at timestamptz, p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.visualizer_catalog_versions%rowtype;
begin
  if not private.can_manage_visualizer_pricing() then raise exception 'No tenés permiso para configurar el Visualizador.' using errcode = '42501'; end if;
  perform private.validate_visualizer_catalog_document(p_document);
  select * into draft from public.visualizer_catalog_versions where id = p_version_id and status = 'draft' for update;
  if not found or draft.updated_at is distinct from p_expected_updated_at then
    raise exception 'El borrador cambió en otra sesión. Recargá antes de guardar.' using errcode = 'P0001';
  end if;
  update public.visualizer_catalog_versions
  set document = p_document, updated_at = clock_timestamp(), created_by = (select auth.uid())
  where id = draft.id;
  return public.get_visualizer_catalog_admin_state();
end;
$$;

create or replace function public.publish_visualizer_catalog_draft(p_version_id uuid, p_expected_updated_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.visualizer_catalog_versions%rowtype;
begin
  if not private.can_manage_visualizer_pricing() then raise exception 'No tenés permiso para configurar el Visualizador.' using errcode = '42501'; end if;
  select * into draft from public.visualizer_catalog_versions where id = p_version_id and status = 'draft' for update;
  if not found or draft.updated_at is distinct from p_expected_updated_at then
    raise exception 'El borrador cambió en otra sesión. Recargá antes de publicar.' using errcode = 'P0001';
  end if;
  perform private.validate_visualizer_catalog_document(draft.document);
  update public.visualizer_catalog_versions set status = 'archived' where status = 'published';
  update public.visualizer_catalog_versions
  set status = 'published', published_at = clock_timestamp(), published_by = (select auth.uid()), updated_at = clock_timestamp()
  where id = draft.id;
  insert into public.visualizer_catalog_versions (version, status, document, created_by)
  values ((select max(version) + 1 from public.visualizer_catalog_versions), 'draft', draft.document, (select auth.uid()));
  return public.get_visualizer_catalog_admin_state();
end;
$$;

revoke all on function private.validate_visualizer_catalog_document(jsonb) from public, anon, authenticated;
revoke all on function public.get_published_visualizer_catalog() from public, anon, authenticated;
revoke all on function public.get_visualizer_catalog_admin_state() from public, anon, authenticated;
revoke all on function public.save_visualizer_catalog_draft(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.publish_visualizer_catalog_draft(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_published_visualizer_catalog() to anon, authenticated;
grant execute on function public.get_visualizer_catalog_admin_state() to authenticated;
grant execute on function public.save_visualizer_catalog_draft(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.publish_visualizer_catalog_draft(uuid, timestamptz) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visualizer-catalog', 'visualizer-catalog', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy visualizer_catalog_admin_upload on storage.objects
for insert to authenticated
with check (bucket_id = 'visualizer-catalog' and (select private.can_manage_visualizer_pricing()));
