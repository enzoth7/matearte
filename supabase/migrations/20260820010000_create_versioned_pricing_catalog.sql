create schema if not exists private;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and length(username) between 3 and 64),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_rule_definitions (
  rule_key text primary key,
  rule_type text not null check (rule_type in ('family', 'texture', 'metal', 'size', 'customization', 'commission')),
  label text not null,
  value_kind text not null check (value_kind in ('uyu', 'percent')),
  family_id text,
  texture_id text,
  color_id text,
  metal_id text,
  size_id text,
  customization_id text,
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  status text not null check (status in ('draft', 'published', 'archived')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists pricing_one_published_version
  on public.pricing_catalog_versions ((status)) where status = 'published';
create unique index if not exists pricing_one_draft_version
  on public.pricing_catalog_versions ((status)) where status = 'draft';
create index if not exists pricing_catalog_versions_created_by_idx
  on public.pricing_catalog_versions (created_by) where created_by is not null;
create index if not exists pricing_catalog_versions_published_by_idx
  on public.pricing_catalog_versions (published_by) where published_by is not null;

create table if not exists public.pricing_catalog_values (
  version_id uuid not null references public.pricing_catalog_versions(id) on delete cascade,
  rule_key text not null references public.pricing_rule_definitions(rule_key) on delete restrict,
  value numeric(14, 2) not null check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (version_id, rule_key)
);

create index if not exists pricing_catalog_values_rule_idx
  on public.pricing_catalog_values (rule_key, version_id);

alter table public.admin_users enable row level security;
alter table public.pricing_rule_definitions enable row level security;
alter table public.pricing_catalog_versions enable row level security;
alter table public.pricing_catalog_values enable row level security;

create or replace function private.is_pricing_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and active = true
  );
$$;

revoke all on function private.is_pricing_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_pricing_admin() to authenticated;

create policy "active pricing definitions are readable"
  on public.pricing_rule_definitions for select
  to anon, authenticated
  using (active = true);

create policy "admins can read their membership"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()) and private.is_pricing_admin());

create policy "published pricing versions are public"
  on public.pricing_catalog_versions for select
  to anon
  using (status = 'published');

create policy "authenticated users read allowed pricing versions"
  on public.pricing_catalog_versions for select
  to authenticated
  using (status = 'published' or private.is_pricing_admin());

create policy "admins can create pricing versions"
  on public.pricing_catalog_versions for insert
  to authenticated
  with check (private.is_pricing_admin() and created_by = (select auth.uid()));

create policy "admins can update pricing versions"
  on public.pricing_catalog_versions for update
  to authenticated
  using (private.is_pricing_admin())
  with check (private.is_pricing_admin());

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

create policy "admins can create pricing values"
  on public.pricing_catalog_values for insert
  to authenticated
  with check (private.is_pricing_admin());

create policy "admins can update pricing values"
  on public.pricing_catalog_values for update
  to authenticated
  using (private.is_pricing_admin())
  with check (private.is_pricing_admin());

create policy "admins can delete pricing values"
  on public.pricing_catalog_values for delete
  to authenticated
  using (private.is_pricing_admin());

revoke all on table public.admin_users from public, anon, authenticated;
revoke all on table public.pricing_rule_definitions from public, anon, authenticated;
revoke all on table public.pricing_catalog_versions from public, anon, authenticated;
revoke all on table public.pricing_catalog_values from public, anon, authenticated;

grant select on table public.admin_users to authenticated;
grant select on table public.pricing_rule_definitions to anon, authenticated;
grant select on table public.pricing_catalog_versions to anon, authenticated;
grant select on table public.pricing_catalog_values to anon, authenticated;

create or replace function public.get_published_pricing_catalog()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'versionId', version.id,
    'version', version.version,
    'publishedAt', version.published_at,
    'rules', coalesce((
      select jsonb_object_agg(value.rule_key, value.value order by value.rule_key)
      from public.pricing_catalog_values value
      where value.version_id = version.id
    ), '{}'::jsonb)
  )
  from public.pricing_catalog_versions version
  where version.status = 'published'
  limit 1;
$$;

create or replace function public.get_pricing_admin_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_pricing_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'definitions', coalesce((
      select jsonb_agg(to_jsonb(definition) order by definition.sort_order, definition.rule_key)
      from public.pricing_rule_definitions definition
      where definition.active = true
    ), '[]'::jsonb),
    'published', (
      select jsonb_build_object(
        'id', version.id,
        'version', version.version,
        'status', version.status,
        'updatedAt', version.updated_at,
        'publishedAt', version.published_at,
        'values', coalesce((
          select jsonb_object_agg(value.rule_key, value.value order by value.rule_key)
          from public.pricing_catalog_values value
          where value.version_id = version.id
        ), '{}'::jsonb)
      )
      from public.pricing_catalog_versions version
      where version.status = 'published'
      limit 1
    ),
    'draft', (
      select jsonb_build_object(
        'id', version.id,
        'version', version.version,
        'status', version.status,
        'updatedAt', version.updated_at,
        'publishedAt', version.published_at,
        'values', coalesce((
          select jsonb_object_agg(value.rule_key, value.value order by value.rule_key)
          from public.pricing_catalog_values value
          where value.version_id = version.id
        ), '{}'::jsonb)
      )
      from public.pricing_catalog_versions version
      where version.status = 'draft'
      limit 1
    )
  );
end;
$$;

create or replace function public.save_pricing_draft(
  p_version_id uuid,
  p_expected_updated_at timestamptz,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version public.pricing_catalog_versions%rowtype;
  pricing_item record;
  numeric_value numeric;
begin
  if not private.is_pricing_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'values must be a JSON object' using errcode = '22023';
  end if;

  select * into current_version
  from public.pricing_catalog_versions
  where id = p_version_id and status = 'draft'
  for update;

  if not found then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;

  if current_version.updated_at is distinct from p_expected_updated_at then
    raise exception 'draft changed in another session' using errcode = 'P0001';
  end if;

  for pricing_item in select key, value from jsonb_each(p_values)
  loop
    if not exists (
      select 1 from public.pricing_rule_definitions
      where rule_key = pricing_item.key and active = true
    ) then
      raise exception 'unknown pricing rule: %', pricing_item.key using errcode = '22023';
    end if;

    if jsonb_typeof(pricing_item.value) = 'null' then
      continue;
    end if;

    if jsonb_typeof(pricing_item.value) <> 'number' then
      raise exception 'pricing rule % must be numeric', pricing_item.key using errcode = '22023';
    end if;

    numeric_value := (pricing_item.value #>> '{}')::numeric;
    if numeric_value < 0 then
      raise exception 'pricing rule % cannot be negative', pricing_item.key using errcode = '22023';
    end if;
  end loop;

  delete from public.pricing_catalog_values where version_id = p_version_id;

  insert into public.pricing_catalog_values (version_id, rule_key, value, updated_at)
  select p_version_id, pricing_rule.rule_key, (pricing_rule.rule_value #>> '{}')::numeric, clock_timestamp()
  from jsonb_each(p_values) as pricing_rule(rule_key, rule_value)
  where jsonb_typeof(pricing_rule.rule_value) = 'number';

  update public.pricing_catalog_versions
  set updated_at = clock_timestamp()
  where id = p_version_id;

  return public.get_pricing_admin_state();
end;
$$;

create or replace function public.publish_pricing_draft(
  p_version_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version public.pricing_catalog_versions%rowtype;
  missing_count integer;
  invalid_count integer;
  next_version integer;
  next_draft_id uuid;
begin
  if not private.is_pricing_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('matearte-pricing-publish'));

  select * into current_version
  from public.pricing_catalog_versions
  where id = p_version_id and status = 'draft'
  for update;

  if not found then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;

  if current_version.updated_at is distinct from p_expected_updated_at then
    raise exception 'draft changed in another session' using errcode = 'P0001';
  end if;

  select count(*) into missing_count
  from public.pricing_rule_definitions definition
  left join public.pricing_catalog_values value
    on value.version_id = p_version_id and value.rule_key = definition.rule_key
  where definition.active = true
    and definition.required = true
    and value.rule_key is null;

  if missing_count > 0 then
    raise exception 'pricing catalog has % missing required values', missing_count using errcode = '23514';
  end if;

  select count(*) into invalid_count
  from public.pricing_rule_definitions definition
  join public.pricing_catalog_values value
    on value.version_id = p_version_id and value.rule_key = definition.rule_key
  where definition.active = true
    and (
      value.value < 0
      or (definition.value_kind = 'percent' and value.value > 100)
    );

  if invalid_count > 0 then
    raise exception 'pricing catalog has % invalid values', invalid_count using errcode = '23514';
  end if;

  select count(*) into invalid_count
  from public.pricing_rule_definitions size_definition
  join public.pricing_catalog_values size_value
    on size_value.version_id = p_version_id and size_value.rule_key = size_definition.rule_key
  join public.pricing_catalog_values family_value
    on family_value.version_id = p_version_id
   and family_value.rule_key = 'family:' || size_definition.family_id
  join public.pricing_catalog_values texture_value
    on texture_value.version_id = p_version_id
   and texture_value.rule_key = 'texture:' || size_definition.family_id || ':' || size_definition.texture_id
  left join public.pricing_catalog_values metal_value
    on metal_value.version_id = p_version_id
   and metal_value.rule_key = 'metal:' || size_definition.family_id || ':' || size_definition.texture_id || ':' || size_definition.color_id || ':' || size_definition.metal_id
  where size_definition.rule_type = 'size'
    and size_definition.active = true
    and family_value.value + texture_value.value + coalesce(metal_value.value, 0) + size_value.value <= 0;

  if invalid_count > 0 then
    raise exception 'pricing catalog has % combinations with a zero total', invalid_count using errcode = '23514';
  end if;

  update public.pricing_catalog_versions
  set status = 'archived', updated_at = clock_timestamp()
  where status = 'published';

  update public.pricing_catalog_versions
  set status = 'published',
      published_at = clock_timestamp(),
      published_by = (select auth.uid()),
      updated_at = clock_timestamp()
  where id = p_version_id;

  select coalesce(max(version), 0) + 1 into next_version
  from public.pricing_catalog_versions;

  insert into public.pricing_catalog_versions (version, status, note, created_by)
  values (next_version, 'draft', 'Borrador creado desde la última publicación', (select auth.uid()))
  returning id into next_draft_id;

  insert into public.pricing_catalog_values (version_id, rule_key, value)
  select next_draft_id, rule_key, value
  from public.pricing_catalog_values
  where version_id = p_version_id;

  return public.get_pricing_admin_state();
end;
$$;

revoke all on function public.get_published_pricing_catalog() from public, anon, authenticated;
revoke all on function public.get_pricing_admin_state() from public, anon, authenticated;
revoke all on function public.save_pricing_draft(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.publish_pricing_draft(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.get_published_pricing_catalog() to anon, authenticated;
grant execute on function public.get_pricing_admin_state() to authenticated;
grant execute on function public.save_pricing_draft(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.publish_pricing_draft(uuid, timestamptz) to authenticated;

create temporary table pricing_seed_textures (
  family_id text not null,
  texture_id text not null,
  label text not null,
  colors text[] not null,
  metals text[] not null,
  skip_metal boolean not null,
  texture_order integer not null
) on commit drop;

insert into pricing_seed_textures values
  ('camionero', 'alpaca-cincelado-patas', 'Camionero alpaca cincelado con patas', array['natural','cuero-crudo','marron','negro'], array['alpaca-cincelada'], false, 1),
  ('imperial', 'cincelado-premium', 'Cincelado Premium', array['vacuno','negro','marron','natural','print-pelos','cuero-crudo'], array['original-imperial'], true, 1),
  ('imperial', 'imperial-clasico', 'Imperial clásico', array['natural','negro','marron'], array['original-imperial'], true, 2),
  ('imperial', 'imperial-print-pelos', 'Imperial print / pelos', array['cueros-pendientes'], array['original-imperial'], true, 3),
  ('imperial', 'imperial-cuero-crudo', 'Imperial cuero crudo', array['cuero-crudo'], array['original-imperial'], true, 4),
  ('imperial', 'imperial-criollo', 'Imperial criollo', array['variante-pendiente'], array['original-imperial'], true, 5),
  ('imperial', 'virola-plata-900', 'Virola Plata 900', array['negro','marron','natural','print','cuero-crudo','criollo'], array['plata-900'], false, 6),
  ('torpedo', 'cuero-liso', 'Cuero liso', array['natural','negro','marron'], array['alpaca-bronce','alpaca-comun','alpaca-grande'], false, 1),
  ('torpedo', 'cuero-estampado', 'Cuero estampado', array['marron','negro'], array['alpaca-bronce','alpaca-comun','alpaca-grande'], false, 2),
  ('torpedo', 'cuero-crudo', 'Cuero crudo', array['cuero-crudo'], array['alpaca-bronce','alpaca-comun','alpaca-grande'], false, 3),
  ('torpedo', 'print-pelos', 'Print / pelos', array['marron-blanco','negro-blanco','animal-print'], array['alpaca-bronce','alpaca-comun','alpaca-grande'], false, 4),
  ('criollo', 'torpedo-criollo-posa-mate', 'Torpedo criollo posa mate', array['vaqueta','cuero-crudo'], array['alpaca-grande-cincelada'], false, 1),
  ('criollo', 'imperial-criollo-posa-mate', 'Imperial criollo posa mate', array['vaqueta','cuero-crudo'], array['original-imperial'], true, 2),
  ('criollo', 'camionero-criollo-posa-mate', 'Camionero criollo posa mate', array['vaqueta','cuero-crudo'], array['original-camionero'], true, 3);

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, sort_order)
values
  ('family:camionero', 'family', 'Camionero · precio base', 'uyu', 'camionero', 10000),
  ('family:imperial', 'family', 'Imperial · precio base', 'uyu', 'imperial', 20000),
  ('family:torpedo', 'family', 'Torpedo · precio base', 'uyu', 'torpedo', 30000),
  ('family:criollo', 'family', 'Criollo · precio base', 'uyu', 'criollo', 40000)
on conflict (rule_key) do nothing;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, texture_id, sort_order)
select
  'texture:' || family_id || ':' || texture_id,
  'texture', label || ' · adicional', 'uyu', family_id, texture_id,
  case family_id when 'camionero' then 10000 when 'imperial' then 20000 when 'torpedo' then 30000 else 40000 end + texture_order * 100
from pricing_seed_textures
on conflict (rule_key) do nothing;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, texture_id, color_id, metal_id, sort_order)
select
  'metal:' || texture.family_id || ':' || texture.texture_id || ':' || color_id || ':' || metal_id,
  'metal', replace(initcap(replace(metal_id, '-', ' ')), 'Alpaca Bronce', 'Alpaca y bronce') || ' · ' || replace(color_id, '-', ' '),
  'uyu', texture.family_id, texture.texture_id, color_id, metal_id,
  case texture.family_id when 'camionero' then 10000 when 'imperial' then 20000 when 'torpedo' then 30000 else 40000 end
    + texture.texture_order * 100 + color_order * 10 + metal_order
from pricing_seed_textures texture
cross join lateral unnest(texture.colors) with ordinality as color(color_id, color_order)
cross join lateral unnest(texture.metals) with ordinality as metal(metal_id, metal_order)
where texture.skip_metal = false
on conflict (rule_key) do nothing;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, texture_id, color_id, metal_id, size_id, sort_order)
select
  'size:' || texture.family_id || ':' || texture.texture_id || ':' || color_id || ':' || metal_id || ':' || size_id,
  'size', initcap(size_id) || ' · ' || texture.label || ' · ' || replace(color_id, '-', ' ') || ' · ' || replace(metal_id, '-', ' '),
  'uyu', texture.family_id, texture.texture_id, color_id, metal_id, size_id,
  case texture.family_id when 'camionero' then 10000 when 'imperial' then 20000 when 'torpedo' then 30000 else 40000 end
    + texture.texture_order * 100 + color_order * 10 + metal_order + size_order
from pricing_seed_textures texture
cross join lateral unnest(texture.colors) with ordinality as color(color_id, color_order)
cross join lateral unnest(texture.metals) with ordinality as metal(metal_id, metal_order)
cross join lateral unnest(array['chico','medio','grande']) with ordinality as size(size_id, size_order)
on conflict (rule_key) do nothing;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, customization_id, sort_order)
values
  ('customization:rim_finish', 'customization', 'Virola · terminación', 'uyu', 'rim_finish', 50010),
  ('customization:rim_text', 'customization', 'Virola · texto', 'uyu', 'rim_text', 50020),
  ('customization:rim_image', 'customization', 'Virola · imagen o escudo', 'uyu', 'rim_image', 50030),
  ('customization:fleje_finish', 'customization', 'Fleje · terminación', 'uyu', 'fleje_finish', 50040),
  ('customization:fleje_text', 'customization', 'Fleje · texto', 'uyu', 'fleje_text', 50050),
  ('customization:fleje_image', 'customization', 'Fleje · imagen o escudo', 'uyu', 'fleje_image', 50060),
  ('commission:mercado_pago', 'commission', 'Comisión de Mercado Pago', 'percent', null, 60000)
on conflict (rule_key) do nothing;

do $$
declare
  published_id uuid;
  draft_id uuid;
begin
  if not exists (select 1 from public.pricing_catalog_versions) then
    insert into public.pricing_catalog_versions
      (version, status, note, published_at, updated_at)
    values
      (1, 'published', 'Importación provisional de precios anteriores', now(), now())
    returning id into published_id;

    insert into public.pricing_catalog_values (version_id, rule_key, value)
    select published_id, definition.rule_key,
      case
        when definition.rule_type = 'family' then
          case definition.family_id when 'camionero' then 787 when 'imperial' then 928 when 'torpedo' then 735 else 475 end
        when definition.rule_type = 'texture' then
          case definition.family_id || ':' || definition.texture_id
            when 'camionero:alpaca-cincelado-patas' then 0
            when 'imperial:cincelado-premium' then 3413
            when 'imperial:imperial-clasico' then 154
            when 'imperial:imperial-print-pelos' then 309
            when 'imperial:imperial-cuero-crudo' then 369
            when 'imperial:imperial-criollo' then 0
            when 'imperial:virola-plata-900' then 12637
            when 'torpedo:cuero-liso' then 0
            when 'torpedo:cuero-estampado' then 122
            when 'torpedo:cuero-crudo' then 193
            when 'torpedo:print-pelos' then 155
            when 'criollo:torpedo-criollo-posa-mate' then 244
            when 'criollo:imperial-criollo-posa-mate' then 453
            else 0
          end
        when definition.rule_type = 'metal' then
          case
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-liso' and definition.metal_id = 'alpaca-bronce' then 177
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-liso' and definition.metal_id = 'alpaca-grande' then 92
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-estampado' and definition.metal_id = 'alpaca-bronce' then 131
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-estampado' and definition.metal_id = 'alpaca-comun' then 8
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-crudo' and definition.metal_id = 'alpaca-bronce' then 122
            when definition.family_id = 'torpedo' and definition.texture_id = 'cuero-crudo' and definition.metal_id = 'alpaca-grande' then 92
            when definition.family_id = 'torpedo' and definition.texture_id = 'print-pelos' and definition.metal_id = 'alpaca-bronce' then 176
            when definition.family_id = 'torpedo' and definition.texture_id = 'print-pelos' and definition.metal_id = 'alpaca-grande' then 92
            when definition.family_id = 'criollo' and definition.texture_id = 'torpedo-criollo-posa-mate' and definition.color_id = 'cuero-crudo' then 155
            else 0
          end
        when definition.rule_type = 'size' then 0
        when definition.rule_key = 'customization:rim_finish' then 100
        when definition.rule_key = 'customization:rim_text' then 150
        when definition.rule_key = 'customization:rim_image' then 400
        when definition.rule_key = 'customization:fleje_finish' then 100
        when definition.rule_key = 'customization:fleje_text' then 150
        when definition.rule_key = 'customization:fleje_image' then 500
        when definition.rule_key = 'commission:mercado_pago' then 0
        else 0
      end
    from public.pricing_rule_definitions definition
    where definition.active = true;

    insert into public.pricing_catalog_versions
      (version, status, note, updated_at)
    values
      (2, 'draft', 'Borrador creado desde la importación provisional', now())
    returning id into draft_id;

    insert into public.pricing_catalog_values (version_id, rule_key, value)
    select draft_id, rule_key, value
    from public.pricing_catalog_values
    where version_id = published_id;
  end if;
end;
$$;

notify pgrst, 'reload schema';
