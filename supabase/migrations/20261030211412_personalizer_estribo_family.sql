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
      if (section_name = 'families' and item_key not in ('camionero', 'imperial', 'torpedo', 'criollo', 'estribo'))
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

revoke all on function private.validate_visualizer_catalog_document(jsonb) from public, anon, authenticated;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, texture_id, required, active, sort_order)
values
  ('family:estribo', 'family', 'Estribo · precio base', 'uyu', 'estribo', null, true, true, 45000),
  ('tree:estribo:imperial', 'texture', 'Estribo Imperial · precio base', 'uyu', 'estribo', 'imperial', true, true, 45100),
  ('tree:estribo:torpedo', 'texture', 'Estribo Torpedo · precio base', 'uyu', 'estribo', 'torpedo', true, true, 45200),
  ('tree:estribo:camionero', 'texture', 'Estribo Camionero · precio base', 'uyu', 'estribo', 'camionero', true, true, 45300)
on conflict (rule_key) do update
set rule_type = excluded.rule_type,
    label = excluded.label,
    value_kind = excluded.value_kind,
    family_id = excluded.family_id,
    texture_id = excluded.texture_id,
    required = excluded.required,
    active = excluded.active,
    sort_order = excluded.sort_order;

-- Seed only current versions. Existing administrative price edits win on reruns.
insert into public.pricing_catalog_values (version_id, rule_key, value, updated_at)
select version.id, seed.rule_key, seed.value, clock_timestamp()
from public.pricing_catalog_versions version
cross join (values
  ('family:estribo'::text, 0::numeric),
  ('tree:estribo:imperial'::text, 4500::numeric),
  ('tree:estribo:torpedo'::text, 3900::numeric),
  ('tree:estribo:camionero'::text, 3500::numeric)
) as seed(rule_key, value)
where version.status in ('published', 'draft')
on conflict (version_id, rule_key) do nothing;

notify pgrst, 'reload schema';
