-- Los mates no tienen un precio base por familia. Traslada el importe técnico
-- existente a cada textura para conservar los totales y desactiva esas cuatro
-- reglas sin alterar las versiones archivadas.
with family_values as (
  select
    version.id as version_id,
    family_definition.family_id,
    family_value.value
  from public.pricing_catalog_versions version
  join public.pricing_catalog_values family_value
    on family_value.version_id = version.id
  join public.pricing_rule_definitions family_definition
    on family_definition.rule_key = family_value.rule_key
   and family_definition.rule_type = 'family'
  where version.status in ('published', 'draft')
)
update public.pricing_catalog_values texture_value
set value = texture_value.value + family_values.value,
    updated_at = clock_timestamp()
from public.pricing_rule_definitions texture_definition,
     family_values
where texture_value.version_id = family_values.version_id
  and texture_value.rule_key = texture_definition.rule_key
  and texture_definition.rule_type = 'texture'
  and texture_definition.family_id = family_values.family_id;

delete from public.pricing_catalog_values family_value
using public.pricing_catalog_versions version,
      public.pricing_rule_definitions family_definition
where family_value.version_id = version.id
  and family_value.rule_key = family_definition.rule_key
  and family_definition.rule_type = 'family'
  and version.status in ('published', 'draft');

update public.pricing_rule_definitions
set active = false,
    required = false
where rule_type = 'family';

update public.pricing_catalog_versions
set updated_at = clock_timestamp()
where status in ('published', 'draft');

-- Conserva la validación transaccional de totales, ahora calculada como
-- textura + metal contextual + tamaño.
create or replace function private.save_and_publish_pricing_impl(
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
  missing_count integer;
  invalid_count integer;
  next_version integer;
  next_draft_id uuid;
begin
  if not private.is_pricing_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'values must be a JSON object' using errcode = '22023';
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

  for pricing_item in select key, value from jsonb_each(p_values)
  loop
    if not exists (
      select 1
      from public.pricing_rule_definitions
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

  select count(*) into missing_count
  from public.pricing_rule_definitions definition
  left join public.pricing_catalog_values value
    on value.version_id = p_version_id and value.rule_key = definition.rule_key
  where definition.active = true and definition.required = true and value.rule_key is null;
  if missing_count > 0 then
    raise exception 'pricing catalog has % missing required values', missing_count using errcode = '23514';
  end if;

  select count(*) into invalid_count
  from public.pricing_rule_definitions definition
  join public.pricing_catalog_values value
    on value.version_id = p_version_id and value.rule_key = definition.rule_key
  where definition.active = true
    and (value.value < 0 or (definition.value_kind = 'percent' and value.value > 100));
  if invalid_count > 0 then
    raise exception 'pricing catalog has % invalid values', invalid_count using errcode = '23514';
  end if;

  select count(*) into invalid_count
  from public.pricing_rule_definitions size_definition
  join public.pricing_catalog_values size_value
    on size_value.version_id = p_version_id and size_value.rule_key = size_definition.rule_key
  join public.pricing_catalog_values texture_value
    on texture_value.version_id = p_version_id
   and texture_value.rule_key = 'texture:' || size_definition.family_id || ':' || size_definition.texture_id
  left join public.pricing_catalog_values metal_value
    on metal_value.version_id = p_version_id
   and metal_value.rule_key = 'metal:' || size_definition.family_id || ':' || size_definition.texture_id || ':' || size_definition.color_id || ':' || size_definition.metal_id
  where size_definition.rule_type = 'size'
    and size_definition.active = true
    and texture_value.value + coalesce(metal_value.value, 0) + size_value.value <= 0;
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

  select coalesce(max(version), 0) + 1
  into next_version
  from public.pricing_catalog_versions;

  insert into public.pricing_catalog_versions (version, status, note, created_by)
  values (next_version, 'draft', 'Estado de trabajo interno', (select auth.uid()))
  returning id into next_draft_id;

  insert into public.pricing_catalog_values (version_id, rule_key, value)
  select next_draft_id, rule_key, value
  from public.pricing_catalog_values
  where version_id = p_version_id;

  return public.get_pricing_admin_state();
end;
$$;

revoke all on function private.save_and_publish_pricing_impl(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function private.save_and_publish_pricing_impl(uuid, timestamptz, jsonb)
  to authenticated;
