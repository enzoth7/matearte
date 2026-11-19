-- crm_panel: «30 * 86400000» desbordaba un entero; ahora es bigint. Mismo comportamiento.

create or replace function public.crm_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.crm_tiene_acceso() then
    raise exception 'Sin permiso para el CRM' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'leads', coalesce((
      select jsonb_agg(to_jsonb(l) || jsonb_build_object('mensajes', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'de', m.de, 'texto', m.texto, 'ts', m.ts, 'plantilla', m.plantilla, 'audio', m.audio, 'manual', m.manual) order by m.orden)
        from (select * from crm.mensajes mm where mm.lead_id = l.id order by mm.orden desc limit 80) m
      ), '[]'::jsonb)) order by l.actualizado_en desc)
      from crm.leads l
      where l.estado <> 'spam' or l.actualizado_en > (extract(epoch from now()) * 1000 - 30::bigint * 86400000)
    ), '[]'::jsonb),
    'asistente', (select to_jsonb(e) from crm.estado_asistente e where e.id = 1),
    'comandos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'creado_por' order by c.creado_en desc)
      from crm.comandos c where c.creado_en > now() - interval '24 hours'
    ), '[]'::jsonb)
  );
end;
$$;
