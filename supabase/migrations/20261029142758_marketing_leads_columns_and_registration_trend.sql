-- Keep the existing contact directory for other Gestión screens. Marketing adds
-- location and the channel of the most recent recorded purchase.
create view public.marketing_leads_directory as
select directory.*,
  coalesce(nullif(profile.country_code, ''), nullif(subscriber.country_code, ''), nullif(local_customer.country, '')) as country,
  latest_purchase.channel
from public.marketing_contact_directory directory
left join auth.users account on lower(btrim(account.email)) = directory.email
left join public.customer_profiles profile on profile.user_id = account.id
left join public.newsletter_subscribers subscriber on subscriber.email = directory.email
left join lateral (
  select customer.id, customer.country
  from public.local_sales_customers customer
  where (directory.email is not null and lower(btrim(customer.email)) = directory.email)
    or (directory.email is null and directory.id = 'phone:' || regexp_replace(customer.phone, '[^0-9]+', '', 'g'))
  order by customer.created_at
  limit 1
) local_customer on true
left join lateral (
  select purchase.channel
  from (
    select case when web_order.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer'
      then 'Mayorista' else 'Web' end as channel,
      coalesce(web_order.paid_at, web_order.created_at) as purchased_at
    from public.orders web_order
    where web_order.user_id = account.id and web_order.paid_at is not null
    union all
    select sale.channel, sale.created_at
    from public.local_sales sale
    where sale.customer_id = local_customer.id
  ) purchase
  order by purchase.purchased_at desc
  limit 1
) latest_purchase on true;

comment on view public.marketing_leads_directory is
  'Leads with their known country and most recent recorded sales channel. Unknown values remain null.';
revoke all on public.marketing_leads_directory from public, anon, authenticated;
grant select on public.marketing_leads_directory to service_role;

-- Each registration is assigned to its local Uruguay calendar day. Purchased
-- means that account has at least one paid web/wholesale order or a local sale.
create view public.marketing_registration_purchase_daily as
with registrations as (
  select (account.created_at at time zone 'America/Montevideo')::date as registered_on,
    exists (
      select 1 from public.orders web_order
      where web_order.user_id = account.id and web_order.paid_at is not null
    ) or exists (
      select 1 from public.local_sales_customers local_customer
      join public.local_sales sale on sale.customer_id = local_customer.id
      where local_customer.source_user_id = account.id
        or lower(btrim(local_customer.email)) = lower(btrim(account.email))
    ) as purchased
  from auth.users account
  where account.created_at >= ((now() at time zone 'America/Montevideo')::date - 29) at time zone 'America/Montevideo'
    and not exists (
      select 1 from public.commerce_admin_users staff where staff.user_id = account.id
    )
)
select registered_on, count(*)::integer as registered,
  count(*) filter (where purchased)::integer as purchased
from registrations
group by registered_on;

comment on view public.marketing_registration_purchase_daily is
  'Daily registration cohorts for the last 30 Uruguay days and how many of those accounts have a recorded purchase.';
revoke all on public.marketing_registration_purchase_daily from public, anon, authenticated;
grant select on public.marketing_registration_purchase_daily to service_role;
