-- Keep the existing RPC stable for already deployed personalizers, which require
-- an exact set of pricing keys. Updated clients use v2 for the Estribo rules.
create or replace function public.get_published_pricing_catalog_v2()
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
      join public.pricing_rule_definitions definition
        on definition.rule_key = value.rule_key and definition.active = true
      where value.version_id = version.id
    ), '{}'::jsonb)
  )
  from public.pricing_catalog_versions version
  where version.status = 'published'
  limit 1;
$$;

revoke all on function public.get_published_pricing_catalog_v2() from public, anon, authenticated;
grant execute on function public.get_published_pricing_catalog_v2() to anon, authenticated;

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
      join public.pricing_rule_definitions definition
        on definition.rule_key = value.rule_key and definition.active = true
      where value.version_id = version.id
        and value.rule_key <> 'family:estribo'
        and value.rule_key not like 'tree:estribo:%'
    ), '{}'::jsonb)
  )
  from public.pricing_catalog_versions version
  where version.status = 'published'
  limit 1;
$$;

revoke all on function public.get_published_pricing_catalog() from public, anon, authenticated;
grant execute on function public.get_published_pricing_catalog() to anon, authenticated;

notify pgrst, 'reload schema';
