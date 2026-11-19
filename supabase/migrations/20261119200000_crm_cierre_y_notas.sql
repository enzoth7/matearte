-- CRM: Gestión también puede cerrar una charla («Ha dicho que sí» con importe, «No sigue» con motivo)
-- y dejar notas internas. Las dos van por la cola, como el resto. crm_panel devuelve las notas.

alter table crm.comandos drop constraint if exists comandos_tipo_check;
alter table crm.comandos add constraint comandos_tipo_check
  check (tipo in ('responder', 'enviar_seguimiento', 'cambiar_etapa', 'guardar_instrucciones', 'guardar_reglas', 'asistente_activo', 'cerrar', 'nota'));

create or replace function public.crm_encolar(p_tipo text, p_lead_id text default null, p_datos jsonb default '{}')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pagina text := case
    when p_tipo in ('responder', 'cambiar_etapa', 'cerrar', 'nota') then 'clientes'
    when p_tipo = 'enviar_seguimiento' then 'seguimiento'
    when p_tipo in ('guardar_instrucciones', 'guardar_reglas', 'asistente_activo') then 'agente'
  end;
  v_id uuid;
begin
  if v_pagina is null then
    raise exception 'Acción desconocida' using errcode = '22023';
  end if;
  if not public.crm_tiene_acceso(v_pagina) then
    raise exception 'Sin permiso para esta acción del CRM' using errcode = '42501';
  end if;
  if p_lead_id is not null and not exists (select 1 from crm.leads where id = p_lead_id) then
    raise exception 'Cliente inexistente' using errcode = '22023';
  end if;
  if octet_length(coalesce(p_datos, '{}'::jsonb)::text) > 60000 then
    raise exception 'Pedido demasiado grande' using errcode = '22023';
  end if;
  insert into crm.comandos (tipo, lead_id, datos, creado_por)
  values (p_tipo, p_lead_id, coalesce(p_datos, '{}'::jsonb), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

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
      select jsonb_agg(to_jsonb(l) || jsonb_build_object(
        'mensajes', coalesce((
          select jsonb_agg(jsonb_build_object('id', m.id, 'de', m.de, 'texto', m.texto, 'ts', m.ts, 'plantilla', m.plantilla, 'audio', m.audio, 'manual', m.manual) order by m.orden)
          from (select * from crm.mensajes mm where mm.lead_id = l.id order by mm.orden desc limit 80) m
        ), '[]'::jsonb),
        'notas', coalesce((
          select jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'ts', n.ts) order by n.ts desc)
          from crm.notas n where n.lead_id = l.id
        ), '[]'::jsonb)
      ) order by l.actualizado_en desc)
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
