-- Keep the preview registration limit aligned with the 10 MB storage bucket and table constraint.
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
       or coalesce(v_size, 0) not between 1 and 10485760 then
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
