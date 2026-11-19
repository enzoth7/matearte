-- CRM: Ajustes en Gestión como el panel del CRM. Pedido «conexiones» (volver a comprobar, números
-- permitidos del modo prueba, desvincular el móvil) y el mensaje aprobado (`plantilla`) en guardar_campo.
-- Las dos piden el permiso de /crm/ajustes. Las claves siguen sin pasar por Gestión.

alter table crm.comandos drop constraint if exists comandos_tipo_check;
alter table crm.comandos add constraint comandos_tipo_check
  check (tipo in ('responder', 'enviar_seguimiento', 'cambiar_etapa', 'guardar_instrucciones', 'guardar_reglas', 'asistente_activo', 'cerrar', 'nota', 'guardar_campo', 'conexiones'));

create or replace function public.crm_encolar(p_tipo text, p_lead_id text default null, p_datos jsonb default '{}')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ruta text := coalesce(p_datos ->> 'ruta', '');
  v_pagina text := case
    when p_tipo in ('responder', 'cambiar_etapa', 'cerrar', 'nota') then 'clientes'
    when p_tipo = 'enviar_seguimiento' then 'seguimiento'
    when p_tipo in ('guardar_instrucciones', 'guardar_reglas', 'asistente_activo') then 'agente'
    when p_tipo = 'conexiones' and coalesce(p_datos ->> 'accion', '') in ('comprobar', 'permitidos', 'desvincular') then 'ajustes'
    when p_tipo = 'guardar_campo' and v_ruta ~ '^(negocio\.(nombre|color|lema)|regional\.(moneda|prefijo)|plantilla)$' then 'ajustes'
    when p_tipo = 'guardar_campo' and v_ruta ~ '^(agente\.(trato|pasarSiempre|frases\.[a-zA-Z]+)|sistema\.(asistente\.modelo|seguimiento\.automatico|avisos\.comercial\.(telefono|detalle)|atencion\.(siempre|dias|desde|hasta)|alcance\.(modo|categorias)|reglas\.[a-zA-Z]+))$' then 'agente'
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
