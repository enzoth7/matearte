create or replace function public.save_pricing_draft(
  p_version_id uuid,
  p_expected_updated_at timestamptz,
  p_values jsonb
)
returns jsonb
language plpgsql
security invoker
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

revoke all on function public.save_pricing_draft(uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_pricing_draft(uuid, timestamptz, jsonb) to authenticated;
