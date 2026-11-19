-- CRM de WhatsApp de MateArte (asistente con IA). Vive aparte, en el esquema `crm`:
-- - `crm_app` es el único usuario con acceso directo, y solo a este esquema. Lo usa el servidor del
--   asistente (hoy la PC de Enzo, después un VPS). Se crea sin acceso: la contraseña la pone Enzo.
-- - `anon` y `authenticated` no ven el esquema. Gestión lee y pide acciones solo con las funciones
--   `public.crm_*`, que exigen permiso de página `/crm/...` (private.gestion_has_page_access).
-- - Las acciones de Gestión (responder, seguimiento, etapa, instrucciones) no se ejecutan acá: quedan en
--   `crm.comandos` y las toma el servidor del asistente, que es el único que habla con WhatsApp.

create schema if not exists crm;
revoke all on schema crm from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_app') then
    create role crm_app nologin noinherit;
  end if;
end
$$;
-- postgres (sin superusuario) necesita ser miembro para darle las tablas a crm_app.
grant crm_app to postgres;
grant usage, create on schema crm to crm_app;
alter role crm_app set search_path = crm;

set local search_path = crm;

-- Las tablas del CRM, tal como las crea lib/bd.ts (así su «create … if not exists» no hace nada).
CREATE TABLE IF NOT EXISTS leads (
    id text PRIMARY KEY,
    telefono text NOT NULL,
    perfil_id text NOT NULL,
    perfil_nombre text NOT NULL,
    nombre text NOT NULL,
    email text,
    zona text,
    origen text NOT NULL CHECK (origen IN ('formulario', 'whatsapp', 'prueba', 'manual')),
    estado text NOT NULL CHECK (estado IN ('nuevo', 'conversacion', 'visita', 'persona', 'spam')),
    datos jsonb NOT NULL,
    huecos_ofrecidos jsonb NOT NULL,
    motivo_persona text,
    motivo_spam text,
    ms_primer_whatsapp integer,
    creado_en bigint NOT NULL,
    actualizado_en bigint NOT NULL,
    cambio_estado_en bigint NOT NULL
  );

CREATE TABLE IF NOT EXISTS mensajes (
    orden bigint GENERATED ALWAYS AS IDENTITY,
    lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    id text NOT NULL,
    de text NOT NULL CHECK (de IN ('cliente', 'agente')),
    texto text NOT NULL,
    ts bigint NOT NULL,
    plantilla boolean NOT NULL DEFAULT false,
    audio boolean NOT NULL DEFAULT false,
    manual boolean NOT NULL DEFAULT false,
    PRIMARY KEY (lead_id, id)
  );

CREATE INDEX IF NOT EXISTS mensajes_por_lead ON mensajes (lead_id, orden);

CREATE TABLE IF NOT EXISTS visitas (
    hueco_id text PRIMARY KEY,
    lead_id text NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
    texto text NOT NULL,
    nombre text NOT NULL,
    perfil_nombre text NOT NULL,
    prueba boolean NOT NULL
  );

CREATE TABLE IF NOT EXISTS notas (
    id text PRIMARY KEY,
    lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    texto text NOT NULL,
    ts bigint NOT NULL
  );

CREATE TABLE IF NOT EXISTS tareas (
    id text PRIMARY KEY,
    lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    texto text NOT NULL,
    vence text,
    hecha boolean NOT NULL DEFAULT false,
    ts bigint NOT NULL
  );

ALTER TABLE leads ADD COLUMN IF NOT EXISTS presupuesto integer;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS cobrado integer;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS etiquetas jsonb NOT NULL DEFAULT '[]';

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ejemplo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS actividad (
    id text PRIMARY KEY,
    lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    texto text NOT NULL,
    ts bigint NOT NULL
  );

CREATE TABLE IF NOT EXISTS proyectos (
    id text PRIMARY KEY,
    foto integer NOT NULL,
    tipo text NOT NULL,
    barrio text NOT NULL,
    estado text NOT NULL CHECK (estado IN ('Proyecto', 'Licencias', 'En obra', 'Acabados', 'Entregada')),
    avance integer NOT NULL CHECK (avance BETWEEN 0 AND 100),
    descripcion text NOT NULL,
    lead_id text REFERENCES leads(id) ON DELETE SET NULL
  );

CREATE TABLE IF NOT EXISTS mensajes_procesados (wamid text PRIMARY KEY);

CREATE TABLE IF NOT EXISTS ajustes (id integer PRIMARY KEY CHECK (id = 1), leads_prueba boolean NOT NULL);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS silenciado_en bigint;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS fuente jsonb;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ms_primera_respuesta integer;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS cierre text CHECK (cierre IN ('si', 'no'));

ALTER TABLE leads ADD COLUMN IF NOT EXISTS cierre_en bigint;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_cierre text;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS vuelta_vista_en bigint;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS coste_ia_usd double precision NOT NULL DEFAULT 0;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_origen_check;

ALTER TABLE leads ADD CONSTRAINT leads_origen_check CHECK (origen IN ('formulario', 'whatsapp', 'prueba', 'manual'));

ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS entrega text;

ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS fallo text;

ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS plantilla_nombre text;

CREATE INDEX IF NOT EXISTS mensajes_por_id ON mensajes (id);

ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS configuracion jsonb NOT NULL DEFAULT '{}';

ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS logos jsonb NOT NULL DEFAULT '{}';

ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS ejemplos_de text;

ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS instrucciones jsonb NOT NULL DEFAULT '{}';

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

ALTER TABLE notas ENABLE ROW LEVEL SECURITY;

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

ALTER TABLE actividad ENABLE ROW LEVEL SECURITY;

ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

ALTER TABLE mensajes_procesados ENABLE ROW LEVEL SECURITY;

ALTER TABLE ajustes ENABLE ROW LEVEL SECURITY;

-- Pedidos de Gestión para el servidor del asistente.
create table if not exists crm.comandos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('responder', 'enviar_seguimiento', 'cambiar_etapa', 'guardar_instrucciones', 'guardar_reglas', 'asistente_activo')),
  lead_id text references crm.leads(id) on delete cascade,
  datos jsonb not null default '{}',
  creado_por uuid not null,
  creado_en timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'error')),
  resultado jsonb,
  hecho_en timestamptz
);
create index if not exists comandos_pendientes on crm.comandos (creado_en) where estado = 'pendiente';

-- Lo que el servidor del asistente publica para Gestión: instrucciones, reglas y si está activo.
create table if not exists crm.estado_asistente (
  id integer primary key check (id = 1),
  instrucciones text not null default '',
  hash text not null default '',
  configuracion jsonb not null default '{}',
  actualizado_en timestamptz not null default now()
);

-- Dueño de todo: crm_app (el CRM hace «alter table … add column if not exists» al conectar).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'crm' loop
    execute format('alter table crm.%I owner to crm_app', t.tablename);
    execute format('alter table crm.%I enable row level security', t.tablename);
  end loop;
end
$$;

reset search_path;

-- ---- Lectura para Gestión ----

create or replace function public.crm_tiene_acceso(p_pagina text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_pagina is null then exists (
      select 1 from unnest(array['inicio', 'clientes', 'seguimiento', 'leads', 'agente', 'ajustes']) as pagina
      where private.gestion_has_page_access('/crm/' || pagina)
    )
    else private.gestion_has_page_access('/crm/' || p_pagina)
  end;
$$;

-- Todo lo que pinta el área CRM: clientes con sus últimos 80 mensajes, el estado del asistente y los
-- pedidos de las últimas 24 horas. Sin permiso, error.
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
      where l.estado <> 'spam' or l.actualizado_en > (extract(epoch from now()) * 1000 - 30 * 86400000)
    ), '[]'::jsonb),
    'asistente', (select to_jsonb(e) from crm.estado_asistente e where e.id = 1),
    'comandos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'creado_por' order by c.creado_en desc)
      from crm.comandos c where c.creado_en > now() - interval '24 hours'
    ), '[]'::jsonb)
  );
end;
$$;

-- Pedir una acción al servidor del asistente. Cada tipo exige su página.
create or replace function public.crm_encolar(p_tipo text, p_lead_id text default null, p_datos jsonb default '{}')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pagina text := case
    when p_tipo in ('responder', 'cambiar_etapa') then 'clientes'
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

revoke all on function public.crm_tiene_acceso(text), public.crm_panel(), public.crm_encolar(text, text, jsonb) from public, anon;
grant execute on function public.crm_tiene_acceso(text), public.crm_panel(), public.crm_encolar(text, text, jsonb) to authenticated;
