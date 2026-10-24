-- Publicar el cambio como una versión nueva sin alterar el historial de precios.
-- El borrador existente debe coincidir con la versión publicada en todas las
-- reglas activas; así no se publican otros cambios por accidente.
do $$
declare
  previous_id uuid;
  current_id uuid;
  next_id uuid;
  changed_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('matearte-pricing-publish'));

  select id into previous_id
  from public.pricing_catalog_versions
  where status = 'published'
  for update;

  select id into current_id
  from public.pricing_catalog_versions
  where status = 'draft'
  for update;

  if previous_id is null or current_id is null then
    raise exception 'Se necesita una versión publicada y un borrador de precios';
  end if;

  select count(*) into changed_count
  from public.pricing_rule_definitions definition
  left join public.pricing_catalog_values previous_value
    on previous_value.version_id = previous_id and previous_value.rule_key = definition.rule_key
  left join public.pricing_catalog_values current_value
    on current_value.version_id = current_id and current_value.rule_key = definition.rule_key
  where definition.active = true
    and previous_value.value is distinct from current_value.value;

  if changed_count > 0 then
    raise exception 'El borrador tiene otros cambios; no se publica automáticamente';
  end if;

  delete from public.pricing_catalog_values
  where version_id = current_id
    and rule_key = 'customization:laser:rim_image';

  update public.pricing_catalog_versions
  set status = 'archived', updated_at = clock_timestamp()
  where id = previous_id;

  update public.pricing_catalog_versions
  set status = 'published', published_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = current_id;

  insert into public.pricing_catalog_versions (version, status, note)
  values ((select max(version) + 1 from public.pricing_catalog_versions), 'draft', 'Borrador creado desde la última publicación')
  returning id into next_id;

  insert into public.pricing_catalog_values (version_id, rule_key, value)
  select next_id, rule_key, value
  from public.pricing_catalog_values
  where version_id = current_id;
end;
$$;
