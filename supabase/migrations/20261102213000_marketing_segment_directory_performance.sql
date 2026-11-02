-- La versión anterior leía marketing_leads_directory, que resuelve país y canal con una
-- subconsulta por cada contacto de la agenda (más de 5.000) y tardaba unos 40 segundos.
-- Esta calcula país y canal de la última compra de una sola vez para todos los correos.
create or replace view public.marketing_segment_directory as
with purchases as (
  select lower(btrim(account.email)) as email, coalesce(web_order.paid_at, web_order.created_at) as purchased_at,
    case when web_order.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then 'Mayorista' else 'Web' end as channel
  from public.orders web_order
  join auth.users account on account.id = web_order.user_id
  where web_order.paid_at is not null
  union all
  select lower(btrim(customer.email)), sale.created_at, sale.channel
  from public.local_sales sale
  join public.local_sales_customers customer on customer.id = sale.customer_id
  where nullif(btrim(customer.email), '') is not null
), stats as (
  select email, count(*)::integer as purchase_count, max(purchased_at) as last_purchase_at,
    (array_agg(channel order by purchased_at desc))[1] as channel
  from purchases
  group by email
), places as (
  select lower(btrim(account.email)) as email, nullif(btrim(profile.country_code), '') as country, 1 as priority
  from auth.users account
  join public.customer_profiles profile on profile.user_id = account.id
  union all
  select lower(btrim(subscriber.email)), nullif(btrim(subscriber.country_code), ''), 2
  from public.newsletter_subscribers subscriber
  union all
  select lower(btrim(customer.email)), nullif(btrim(customer.country), ''), 3
  from public.local_sales_customers customer
  where nullif(btrim(customer.email), '') is not null
), country as (
  select distinct on (email) email, country
  from places
  where country is not null
  order by email, priority
)
select e.email, e.name, e.subscription_status, directory.source,
  -- El país llega como código ("UY") o como nombre ("Uruguay"); se unifica en código.
  case
    when country.country ~ '^[A-Za-z]{2}$' then upper(country.country)
    else coalesce(country_name.code, country.country)
  end as country,
  stats.channel,
  coalesce(directory.has_account, false) as has_account, directory.created_at,
  coalesce(stats.purchase_count, 0) as purchase_count, stats.last_purchase_at
from public.marketing_campaign_email_directory e
left join public.marketing_contact_directory directory on directory.email = e.email
left join country on country.email = e.email
left join (values
  ('uruguay', 'UY'), ('argentina', 'AR'), ('brasil', 'BR'), ('chile', 'CL'), ('paraguay', 'PY'),
  ('españa', 'ES'), ('estados unidos', 'US'), ('méxico', 'MX'), ('francia', 'FR'), ('canadá', 'CA'),
  ('japón', 'JP'), ('países bajos', 'NL'), ('italia', 'IT'), ('alemania', 'DE'), ('portugal', 'PT')
) as country_name(name, code) on country_name.name = lower(country.country)
left join stats on stats.email = e.email;
