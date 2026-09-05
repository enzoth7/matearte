-- Private, versioned production renders for customer designs.
create table public.design_previews (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('mate', 'virola', 'fleje_front', 'fleje_back')),
  bucket_id text not null default 'design-previews' check (bucket_id = 'design-previews'),
  object_path text not null,
  mime_type text not null default 'image/png' check (mime_type = 'image/png'),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (design_id, user_id) references public.designs(id, user_id) on delete cascade,
  unique (design_id, role),
  unique (bucket_id, object_path)
);

create index design_previews_user_idx on public.design_previews (user_id, updated_at desc);

grant select, insert, update, delete on public.design_previews to authenticated;
alter table public.design_previews enable row level security;

create policy design_previews_select_own_or_admin
on public.design_previews for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_commerce_admin()));

create policy design_previews_insert_own
on public.design_previews for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy design_previews_update_own
on public.design_previews for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy design_previews_delete_own
on public.design_previews for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger design_previews_updated_at
before update on public.design_previews
for each row execute function private.set_updated_at();

create or replace function public.replace_design_previews(
  p_design_id uuid,
  p_previews jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_preview jsonb;
  v_role text;
  v_path text;
  v_size bigint;
  v_result jsonb;
  v_has_fleje boolean;
begin
  if v_user_id is null then raise exception 'Necesitás iniciar sesión'; end if;
  if not exists (select 1 from public.designs where id = p_design_id and user_id = v_user_id) then
    raise exception 'El diseño no existe o no te pertenece';
  end if;
  if p_previews is null or jsonb_typeof(p_previews) <> 'array' or jsonb_array_length(p_previews) < 2 or jsonb_array_length(p_previews) > 4 then
    raise exception 'Las vistas del diseño están incompletas';
  end if;
  if (select count(distinct value ->> 'role') from jsonb_array_elements(p_previews)) <> jsonb_array_length(p_previews) then
    raise exception 'Hay vistas del diseño repetidas';
  end if;
  if not p_previews @> '[{"role":"mate"}]'::jsonb or not p_previews @> '[{"role":"virola"}]'::jsonb then
    raise exception 'Faltan las vistas del mate o la virola';
  end if;
  select coalesce((configuration #>> '{capabilities,hasFleje}')::boolean, false)
  into v_has_fleje
  from public.designs
  where id = p_design_id and user_id = v_user_id;
  if v_has_fleje and (not p_previews @> '[{"role":"fleje_front"}]'::jsonb or not p_previews @> '[{"role":"fleje_back"}]'::jsonb) then
    raise exception 'Faltan las vistas del fleje';
  end if;

  for v_preview in select value from jsonb_array_elements(p_previews)
  loop
    v_role := v_preview ->> 'role';
    v_path := v_preview ->> 'object_path';
    v_size := nullif(v_preview ->> 'byte_size', '')::bigint;
    if v_role not in ('mate', 'virola', 'fleje_front', 'fleje_back')
       or v_path is null
       or v_path like '%..%'
       or left(v_path, length(v_user_id::text || '/' || p_design_id::text || '/')) <> v_user_id::text || '/' || p_design_id::text || '/'
       or coalesce(v_size, 0) not between 1 and 5242880 then
      raise exception 'Una vista del diseño no es válida';
    end if;

    insert into public.design_previews (design_id, user_id, role, object_path, byte_size)
    values (p_design_id, v_user_id, v_role, v_path, v_size)
    on conflict (design_id, role) do update set
      object_path = excluded.object_path,
      byte_size = excluded.byte_size,
      updated_at = now();
  end loop;

  delete from public.design_previews
  where design_id = p_design_id
    and user_id = v_user_id
    and role not in (select value ->> 'role' from jsonb_array_elements(p_previews));

  update public.designs
  set preview_path = (
    select object_path from public.design_previews
    where design_id = p_design_id and role = 'mate'
  )
  where id = p_design_id and user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role', role,
    'bucket_id', bucket_id,
    'object_path', object_path,
    'mime_type', mime_type,
    'byte_size', byte_size
  ) order by case role when 'mate' then 1 when 'virola' then 2 when 'fleje_front' then 3 else 4 end), '[]'::jsonb)
  into v_result
  from public.design_previews
  where design_id = p_design_id;

  return v_result;
end;
$$;

revoke all on function public.replace_design_previews(uuid, jsonb) from public, anon;
grant execute on function public.replace_design_previews(uuid, jsonb) to authenticated;

create or replace function private.attach_design_artifacts_to_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_previews jsonb;
  v_assets jsonb;
begin
  if new.item_type <> 'design' or new.source_design_id is null then return new; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role', role,
    'bucket_id', bucket_id,
    'object_path', object_path,
    'mime_type', mime_type,
    'byte_size', byte_size
  ) order by case role when 'mate' then 1 when 'virola' then 2 when 'fleje_front' then 3 else 4 end), '[]'::jsonb)
  into v_previews
  from public.design_previews
  where design_id = new.source_design_id;

  select coalesce(jsonb_agg(to_jsonb(asset)), '[]'::jsonb)
  into v_assets
  from public.design_assets asset
  where asset.design_id = new.source_design_id
    and position('storage:' || asset.bucket_id || ':' || asset.object_path in coalesce(new.immutable_snapshot, '{}'::jsonb)::text) > 0;

  new.immutable_snapshot := jsonb_set(
    jsonb_set(coalesce(new.immutable_snapshot, '{}'::jsonb), '{assets}', v_assets, true),
    '{previews}', v_previews, true
  );
  return new;
end;
$$;

drop trigger if exists order_items_attach_design_artifacts on public.order_items;
create trigger order_items_attach_design_artifacts
before insert on public.order_items
for each row execute function private.attach_design_artifacts_to_order_item();

comment on table public.design_previews is
  'Current versioned PNG renders for each production view of a customer design. Order snapshots retain historical object paths.';
comment on function public.replace_design_previews(uuid, jsonb) is
  'Atomically replaces the current render manifest after versioned PNG objects are uploaded.';
