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
    if section_name not in ('families', 'textures', 'colors', 'metals', 'techniques', 'sizes') or jsonb_typeof(item_value) <> 'object' then
      raise exception 'Sección del catálogo inválida: %', section_name;
    end if;
    for item_key, item_value in select key, value from jsonb_each(item_value) loop
      if length(item_key) > 120 or item_key !~ '^[a-z0-9-]+(::[a-z0-9-]+){0,2}$' or jsonb_typeof(item_value) <> 'object' then
        raise exception 'Opción del catálogo inválida: %', item_key;
      end if;
      if (section_name = 'families' and item_key not in ('camionero', 'imperial', 'torpedo', 'criollo', 'estribo'))
        or (section_name = 'techniques' and item_key not in ('laser', 'bronze-applique', 'alpaca-applique'))
        or (section_name = 'sizes' and item_key not in ('standard::chico', 'standard::medio', 'standard::grande', 'torpedo::chico', 'torpedo::medio', 'torpedo::grande')) then
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
        elsif field_name in ('imageCrop', 'flejeImageCrop', 'torpedoImageCrop') then
          if jsonb_typeof(field_value) <> 'object' then
            raise exception 'Encuadre inválido para %', item_key;
          end if;
          if not (field_value ?& array['x', 'y', 'zoom'])
            or exists (select 1 from jsonb_object_keys(field_value) as crop_key(name) where name not in ('x', 'y', 'zoom')) then
            raise exception 'Encuadre inválido para %', item_key;
          end if;
          if jsonb_typeof(field_value->'x') <> 'number' or jsonb_typeof(field_value->'y') <> 'number'
            or jsonb_typeof(field_value->'zoom') <> 'number' then
            raise exception 'Encuadre inválido para %', item_key;
          end if;
          if abs((field_value->>'x')::numeric) > 75 or abs((field_value->>'y')::numeric) > 75
            or (field_value->>'zoom')::numeric not between 1 and 2.5 then
            raise exception 'Encuadre fuera de rango para %', item_key;
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
        if (section_name = 'families' and field_name not in ('label', 'description', 'image', 'imageCrop', 'enabled'))
          or (section_name = 'textures' and field_name not in ('label', 'description', 'image', 'imageCrop', 'enabled', 'virola', 'fleje'))
          or (section_name = 'colors' and field_name not in ('label', 'image', 'imageCrop', 'swatch', 'enabled'))
          or (section_name = 'metals' and field_name not in ('label', 'image', 'imageCrop', 'enabled'))
          or (section_name = 'techniques' and field_name not in ('label', 'description', 'image', 'imageCrop', 'flejeImage', 'flejeImageCrop', 'torpedoImage', 'torpedoImageCrop', 'enabled'))
          or (section_name = 'sizes' and field_name not in ('image', 'imageCrop')) then
          raise exception 'Campo no aplicable a %: %', section_name, field_name;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function private.validate_visualizer_catalog_document(jsonb) from public, anon, authenticated;
