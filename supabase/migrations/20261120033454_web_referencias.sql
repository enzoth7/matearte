create table public.web_referencias (
  codigo text primary key check (codigo ~ '^[A-F0-9]{12}$'),
  utm_source varchar(100),
  utm_medium varchar(100),
  utm_campaign varchar(100),
  utm_content varchar(100),
  fbclid varchar(500),
  ad_id varchar(100),
  fecha timestamptz not null default now(),
  check (num_nonnulls(utm_source, utm_medium, utm_campaign, utm_content, fbclid, ad_id) > 0)
);

alter table public.web_referencias enable row level security;
revoke all on public.web_referencias from public, anon, authenticated, service_role, crm_app;
grant insert on public.web_referencias to service_role;
grant select on public.web_referencias to crm_app;
create policy crm_lee_referencias on public.web_referencias for select to crm_app using (true);
