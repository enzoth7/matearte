-- Segmentos guardados, tandas de envío y descuento por campaña.
-- La audiencia de una campaña sigue siendo toda persona con correo que no se dio de baja;
-- un segmento solo ordena esa base por criterios de compra, origen y país.

create table public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index marketing_segments_name_idx on public.marketing_segments (lower(btrim(name)));
revoke all on public.marketing_segments from public, anon, authenticated;
grant all on public.marketing_segments to service_role;
alter table public.marketing_segments enable row level security;

-- Una fila por correo enviable: la misma base que usan las campañas más origen, país,
-- canal de la última compra y estadísticas de compra. "Compra" se define igual que en
-- Leads: pedido web pagado o venta registrada en el local.
create view public.marketing_segment_directory as
with purchases as (
  select lower(btrim(account.email)) as email, coalesce(web_order.paid_at, web_order.created_at) as purchased_at
  from public.orders web_order
  join auth.users account on account.id = web_order.user_id
  where web_order.paid_at is not null
  union all
  select lower(btrim(customer.email)), sale.created_at
  from public.local_sales sale
  join public.local_sales_customers customer on customer.id = sale.customer_id
  where nullif(btrim(customer.email), '') is not null
), stats as (
  select email, count(*)::integer as purchase_count, max(purchased_at) as last_purchase_at
  from purchases
  group by email
)
select e.email, e.name, e.subscription_status, lead.source,
  -- El país llega como código ("UY") o como nombre ("Uruguay"); se unifica en código.
  case
    when btrim(lead.country) ~ '^[A-Za-z]{2}$' then upper(btrim(lead.country))
    else coalesce(country_name.code, nullif(btrim(lead.country), ''))
  end as country,
  lead.channel,
  coalesce(lead.has_account, false) as has_account, lead.created_at,
  coalesce(stats.purchase_count, 0) as purchase_count, stats.last_purchase_at
from public.marketing_campaign_email_directory e
left join public.marketing_leads_directory lead on lead.email = e.email
left join (values
  ('uruguay', 'UY'), ('argentina', 'AR'), ('brasil', 'BR'), ('chile', 'CL'), ('paraguay', 'PY'),
  ('españa', 'ES'), ('estados unidos', 'US'), ('méxico', 'MX'), ('francia', 'FR'), ('canadá', 'CA'),
  ('japón', 'JP'), ('países bajos', 'NL'), ('italia', 'IT'), ('alemania', 'DE'), ('portugal', 'PT')
) as country_name(name, code) on country_name.name = lower(btrim(lead.country))
left join stats on stats.email = e.email;

comment on view public.marketing_segment_directory is
  'Correos enviables de campañas con origen, país, canal de la última compra y estadísticas de compra.';
revoke all on public.marketing_segment_directory from public, anon, authenticated;
grant select on public.marketing_segment_directory to service_role;

-- Una campaña dividida en tandas son varios borradores con el mismo batch_group_id.
alter table public.marketing_campaigns
  add column batch_group_id uuid,
  add column batch_number integer,
  add column batch_total integer,
  add column segment_name text check (segment_name is null or char_length(segment_name) <= 80),
  add column discount_code text check (discount_code is null or discount_code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'),
  add column utm_campaign text check (utm_campaign is null or utm_campaign ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  add constraint marketing_campaigns_batch_check check (
    (batch_group_id is null and batch_number is null and batch_total is null)
    or (batch_group_id is not null and batch_number >= 1 and batch_total >= batch_number)
  );
create index marketing_campaigns_batch_group_idx
  on public.marketing_campaigns (batch_group_id) where batch_group_id is not null;

-- Quien ya ve campañas puede usar y consultar segmentos.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/marketing/segmentos')
where allowed_paths is not null
  and '/marketing/campanas' = any(allowed_paths)
  and not '/marketing/segmentos' = any(allowed_paths);
