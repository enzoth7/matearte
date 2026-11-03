-- The acquisition channel belongs to the contact; the sale channel belongs to
-- the transaction. Wholesale is a customer type, never a sale channel.
alter table public.local_sales_customers
  add column origin_channel text not null default 'Local',
  add column customer_type text not null default 'Minorista';
alter table public.customer_profiles
  add column origin_channel text not null default 'Web',
  add column customer_type text not null default 'Minorista';
alter table public.newsletter_subscribers
  add column origin_channel text not null default 'Web',
  add column customer_type text not null default 'Minorista';
alter table public.rural_raffle_entries
  add column origin_channel text not null default 'Sorteo',
  add column customer_type text not null default 'Minorista';
alter table public.customers
  add column origin_channel text not null default 'WhatsApp',
  add column customer_type text not null default 'Mayorista';
alter table public.order_lines
  add column sale_channel text not null default 'WhatsApp';

alter table public.local_sales_customers add constraint local_customers_origin_channel_check
  check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo'));
alter table public.customer_profiles add constraint customer_profiles_origin_channel_check
  check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo'));
alter table public.newsletter_subscribers add constraint newsletter_origin_channel_check
  check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo'));
alter table public.rural_raffle_entries add constraint rural_origin_channel_check
  check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo'));
alter table public.customers add constraint wholesale_customers_origin_channel_check
  check (origin_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria','Agenda','Sorteo'));
alter table public.order_lines add constraint wholesale_lines_sale_channel_check
  check (sale_channel in ('Local','Web','WhatsApp','Instagram','Facebook','Feria'));
alter table public.local_sales_customers add constraint local_customers_type_check check (customer_type in ('Minorista','Mayorista'));
alter table public.customer_profiles add constraint customer_profiles_type_check check (customer_type in ('Minorista','Mayorista'));
alter table public.newsletter_subscribers add constraint newsletter_type_check check (customer_type in ('Minorista','Mayorista'));
alter table public.rural_raffle_entries add constraint rural_type_check check (customer_type in ('Minorista','Mayorista'));
alter table public.customers add constraint wholesale_customers_type_check check (customer_type in ('Minorista','Mayorista'));

-- The imported agenda predates these systems. Existing linked Web contacts
-- retain their original acquisition channel even after a local purchase.
update public.local_sales_customers set origin_channel = 'Agenda'
where agenda_import_key is not null;
update public.local_sales_customers set origin_channel = 'Web'
where agenda_import_key is null and (source_user_id is not null or linked_customer_id is not null);
update public.local_sales_customers c set origin_channel = first_sale.channel
from (
  select distinct on (s.customer_id) s.customer_id, s.channel
  from public.local_sales s
  where s.customer_id is not null
  order by s.customer_id, s.sold_on, s.created_at, s.id
) first_sale
where first_sale.customer_id = c.id and c.agenda_import_key is null and c.source_user_id is null
  and c.linked_customer_id is null;

-- Accounts without an order and newsletter-only subscribers also appear in
-- Gestion. Direct table access stays restricted; only admins can call this.
create or replace function public.gestion_web_leads(
  p_offset integer default 0, p_limit integer default 100
)
returns table (
  source_kind text, source_id text, full_name text, email text, phone text,
  city text, country_code text, birth_date date, company text,
  origin_channel text, customer_type text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select * from (
    select 'account'::text, p.user_id::text,
      nullif(btrim(p.full_name), ''), lower(btrim(u.email)), p.phone,
      p.city, p.country_code, p.birth_date, p.company,
      p.origin_channel, p.customer_type, p.created_at
    from public.customer_profiles p
    join auth.users u on u.id = p.user_id
    where u.deleted_at is null and u.email is not null
      and not exists (select 1 from public.commerce_admin_users a where a.user_id = p.user_id and a.active)
    union all
    select 'newsletter'::text, n.id::text, nullif(btrim(n.first_name), ''),
      n.email, null::text, null::text, null::text, null::date, null::text,
      n.origin_channel, n.customer_type, n.created_at
    from public.newsletter_subscribers n
  ) leads(source_kind, source_id, full_name, email, phone, city, country_code,
          birth_date, company, origin_channel, customer_type, created_at)
  where auth.uid() is not null and private.is_commerce_admin(auth.uid())
  order by created_at, source_kind, source_id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;
revoke all on function public.gestion_web_leads(integer, integer) from public, anon;
grant execute on function public.gestion_web_leads(integer, integer) to authenticated;
